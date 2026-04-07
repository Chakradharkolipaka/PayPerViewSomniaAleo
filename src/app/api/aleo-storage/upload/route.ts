import { NextResponse } from "next/server";
import { randomBytes, createCipheriv, createHmac } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { put } from "@vercel/blob";
import { createVideoRecord, setVideoEncryptedAsset } from "@/lib/server/video-catalog";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

function getBlobToken() {
  return process.env.BLOB_READ_WRITE_TOKEN || process.env.VERCEL_BLOB_READ_WRITE_TOKEN;
}

function canUseBlobStorage() {
  return Boolean(getBlobToken());
}

function deriveVideoKey(videoId: number): Buffer {
  const masterKey = process.env.PPV_MASTER_KEY;
  if (!masterKey) {
    throw new Error("PPV_MASTER_KEY is missing");
  }

  return createHmac("sha256", masterKey).update(`ppv:${videoId}`).digest();
}

export async function POST(request: Request) {
  try {
    const body = await request.formData();
    const title = String(body.get("title") || "").trim();
    const description = String(body.get("description") || "").trim();
    const creator = String(body.get("creator") || "").trim();
    const file = body.get("file");

    if (!title || !description || !creator) {
      return NextResponse.json(
        { error: "title, description, and creator are required." },
        { status: 400 }
      );
    }

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "Missing .mp4 file." }, { status: 400 });
    }

    const isMp4 = file.type === "video/mp4" || file.name.toLowerCase().endsWith(".mp4");
    if (!isMp4) {
      return NextResponse.json({ error: "Only .mp4 uploads are supported." }, { status: 400 });
    }

    if (file.size > MAX_VIDEO_BYTES) {
      return NextResponse.json(
        { error: `Video file is too large. Max size is ${Math.floor(MAX_VIDEO_BYTES / 1024 / 1024)}MB.` },
        { status: 400 }
      );
    }

    const pending = await createVideoRecord({
      title,
      description,
      creator,
      encryptedAssetUrl: "",
    });

    const videoId = pending.id;
    const source = Buffer.from(await file.arrayBuffer());
    const key = deriveVideoKey(videoId);
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", key, iv);
    const encrypted = Buffer.concat([cipher.update(source), cipher.final()]);

    const out = Buffer.concat([iv, encrypted]);
    const encryptedName = `video_${videoId}.enc`;
    let encryptedAssetUrl = "";

    if (canUseBlobStorage()) {
      const token = getBlobToken();
      const blob = await put(`ppv/encrypted/${encryptedName}`, out, {
        access: "public",
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: "application/octet-stream",
        token,
      });
      encryptedAssetUrl = blob.url;
    } else {
      const encryptedDir = path.join(process.cwd(), "public", "encrypted");
      await fs.mkdir(encryptedDir, { recursive: true });
      const encryptedPath = path.join(encryptedDir, encryptedName);
      await fs.writeFile(encryptedPath, out);
      encryptedAssetUrl = `/encrypted/${encryptedName}`;
    }

    await setVideoEncryptedAsset(videoId, encryptedAssetUrl);

    return NextResponse.json({
      ok: true,
      videoId,
      encryptedAssetUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}