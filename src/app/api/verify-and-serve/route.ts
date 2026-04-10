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
          proofTraceId?: string;
        }
      | null;

    if (!body) {
      return NextResponse.json({ status: "error", message: "Invalid request body." }, { status: 400 });
    }

    const tokenId = body.tokenId;
    const viewerAddressRaw = body.viewerAddress || body.viewer;
    const viewerAddress = typeof viewerAddressRaw === "string" ? viewerAddressRaw.trim() : viewerAddressRaw;
    const consumedAleoRecord =
      typeof body.consumedAleoRecord === "string" ? body.consumedAleoRecord.trim() : body.consumedAleoRecord;
    const proofTraceId = typeof body.proofTraceId === "string" ? body.proofTraceId.trim() : undefined;

    if (tokenId === undefined || tokenId === null || viewerAddress === undefined || viewerAddress === "") {
      return NextResponse.json(
        { status: "error", message: "tokenId and viewerAddress are required." },
        { status: 400 }
      );
    }

    if (consumedAleoRecord !== undefined && consumedAleoRecord === "") {
      return NextResponse.json(
        { status: "error", message: "consumedAleoRecord cannot be empty when provided." },
        { status: 400 }
      );
    }

    const result = await verifyAndServeAccess({
      tokenId,
      viewerAddress,
      consumedAleoRecord,
    });

    if (debug && proofTraceId) {
      console.debug("[api/verify-and-serve] proofTraceId:", proofTraceId);
    }

    return NextResponse.json({ ...result, proofTraceId: proofTraceId || "" });
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