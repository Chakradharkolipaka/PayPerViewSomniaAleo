import { NextResponse } from "next/server";
import { PPVServerError, verifyAndServeAccess } from "@/lib/server/ppv-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const debug = process.env.LOG_LEVEL === "debug";

export async function POST(request: Request) {
  try {
    const body = (await request.json().catch(() => null)) as
      | {
          tokenId?: string | number;
          viewerAddress?: string;
          viewer?: string;
          consumedAleoRecord?: string;
        }
      | null;

    if (!body) {
      return NextResponse.json({ status: "error", message: "Invalid request body." }, { status: 400 });
    }

    const tokenId = body.tokenId;
    const viewerAddress = body.viewerAddress || body.viewer;

    if (tokenId === undefined || tokenId === null || viewerAddress === undefined) {
      return NextResponse.json(
        { status: "error", message: "tokenId and viewerAddress are required." },
        { status: 400 }
      );
    }

    const result = await verifyAndServeAccess({
      tokenId,
      viewerAddress,
      consumedAleoRecord: body.consumedAleoRecord,
    });

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PPVServerError) {
      if (debug) {
        console.error("[api/verify-and-serve]", error.message);
      }

      return NextResponse.json(
        { status: "error", message: error.message },
        { status: error.statusCode }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error. Please try again.";

    if (debug) {
      console.error("[api/verify-and-serve] unexpected error", error);
    }

    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}