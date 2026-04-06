import { NextResponse } from "next/server";

export const runtime = "nodejs";

export async function POST() {
  return NextResponse.json(
    { error: "IPFS upload disabled in this architecture. Use /api/encrypt-url." },
    { status: 410 }
  );
}
