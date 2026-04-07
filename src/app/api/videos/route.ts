import { NextResponse } from "next/server";
import { listVideos } from "@/lib/server/video-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const videos = await listVideos();
    return NextResponse.json({ videos });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to load videos.";
    return NextResponse.json({ error: message, videos: [] }, { status: 503 });
  }
}