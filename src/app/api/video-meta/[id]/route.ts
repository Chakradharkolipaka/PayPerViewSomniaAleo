import { NextResponse } from "next/server";
import { getVideoMeta } from "@/lib/server/ppv-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const videoId = Number(params.id);

  if (!Number.isFinite(videoId)) {
    return NextResponse.json({ error: "Invalid video id" }, { status: 400 });
  }

  const meta = await getVideoMeta(videoId);

  if (!meta) {
    return NextResponse.json({ error: "Video not found" }, { status: 404 });
  }

  return NextResponse.json({ videoId, ...meta });
}