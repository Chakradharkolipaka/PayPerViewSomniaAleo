import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "Endpoint removed. Use /api/content for encrypted static asset metadata." },
    { status: 410 }
  );
}
