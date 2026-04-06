import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Deprecated endpoint. Use /api/stream for Somnia PPV access." },
    { status: 410 }
  );
}
