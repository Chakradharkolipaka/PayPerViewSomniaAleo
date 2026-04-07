import { NextResponse } from "next/server";

export async function GET() {
  return NextResponse.json(
    { error: "Deprecated endpoint. Use /api/content for encrypted asset metadata." },
    { status: 410 }
  );
}
