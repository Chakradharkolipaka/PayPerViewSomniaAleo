import { NextResponse } from "next/server";
import { listVideos } from "@/lib/server/video-catalog";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const videos = await listVideos();
  return NextResponse.json({ videos });
}