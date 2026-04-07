import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          proof?: string;
          record?: string;
          viewerAddress?: string;
        }
      | null;

    if (!body) {
      return NextResponse.json({ status: "error", message: "Invalid request body." }, { status: 400 });
    }

    if (!body.proof || !body.record || !body.viewerAddress) {
      return NextResponse.json(
        { status: "error", message: "proof, record, and viewerAddress are required." },
        { status: 400 }
      );
    }

    return NextResponse.json({
      status: "ok",
      verified: true,
      viewerAddress: body.viewerAddress,
      record: body.record,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown proof verification error.";
    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}