import { NextResponse } from "next/server";
import { randomBytes, createCipheriv, createHmac } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { createVideoRecord, setVideoEncryptedAsset } from "@/lib/server/video-catalog";

export const runtime = "nodejs";

const MAX_VIDEO_BYTES = 100 * 1024 * 1024; // 100 MB

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
    const encryptedDir = path.join(process.cwd(), "public", "encrypted");
    await fs.mkdir(encryptedDir, { recursive: true });

    const source = Buffer.from(await file.arrayBuffer());
    const key = deriveVideoKey(videoId);
    const iv = randomBytes(16);
    const cipher = createCipheriv("aes-256-cbc", key, iv);
    const encrypted = Buffer.concat([cipher.update(source), cipher.final()]);

    const out = Buffer.concat([iv, encrypted]);
    const encryptedName = `video_${videoId}.enc`;
    const encryptedPath = path.join(encryptedDir, encryptedName);
    await fs.writeFile(encryptedPath, out);

    await setVideoEncryptedAsset(videoId, `/encrypted/${encryptedName}`);

    return NextResponse.json({
      ok: true,
      videoId,
      encryptedAssetUrl: `/encrypted/${encryptedName}`,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Upload failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}