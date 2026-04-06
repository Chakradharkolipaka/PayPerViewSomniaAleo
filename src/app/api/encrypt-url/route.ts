import { NextResponse } from "next/server";
import { encryptYoutubeUrlForAleo } from "@/lib/encryption";

export const runtime = "nodejs";

function isAuthorized(req: Request) {
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!token) return false;
  const auth = req.headers.get("authorization");
  return auth === `Bearer ${token}`;
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const youtubeUrl = body?.youtubeUrl as string | undefined;
  const viewerAleoAddress = body?.viewerAleoAddress as string | undefined;
  const videoId = body?.videoId as number | undefined;

  if (!youtubeUrl || !viewerAleoAddress || typeof videoId !== "number") {
    return NextResponse.json(
      { error: "Missing required fields: youtubeUrl, viewerAleoAddress, videoId" },
      { status: 400 }
    );
  }

  const encryptedUrlChunks = encryptYoutubeUrlForAleo(youtubeUrl, viewerAleoAddress);

  return NextResponse.json({
    videoId,
    encrypted_url: encryptedUrlChunks,
    expiresAtBlockOffset: 43200,
  });
}
