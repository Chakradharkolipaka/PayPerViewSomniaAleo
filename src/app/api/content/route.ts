import { NextResponse } from "next/server";

export const runtime = "nodejs";

function getEncryptedAsset(videoId: number): string | undefined {
  return process.env[`ENCRYPTED_ASSET_VIDEO_${videoId}`];
}

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawVideoId = searchParams.get("videoId");

  if (!rawVideoId) {
    return NextResponse.json({ error: "Missing videoId" }, { status: 400 });
  }

  const videoId = Number(rawVideoId);
  if (!Number.isFinite(videoId)) {
    return NextResponse.json({ error: "Invalid videoId" }, { status: 400 });
  }

  const encryptedAssetUrl = getEncryptedAsset(videoId);
  if (!encryptedAssetUrl) {
    return NextResponse.json(
      { error: `Missing ENCRYPTED_ASSET_VIDEO_${videoId}` },
      { status: 404 }
    );
  }

  return NextResponse.json({
    videoId,
    encryptedAssetUrl,
  });
}
