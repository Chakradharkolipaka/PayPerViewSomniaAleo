/**
 * POST /api/watch-gate/[videoId]
 *
 * Verifies that the caller owns an un-consumed AccessNFT for the requested video,
 * burns the token on-chain, and returns the AES decryption key for the encrypted asset.
 *
 * Request body (JSON):
 *   { tokenId: string | number, viewerAddress: string, consumedAleoRecord?: string }
 *
 * Responses:
 *   200 { status: "consumed", decryptionKey, videoId, consumedAleoRecord }
 *   400 Bad request (missing/invalid fields)
 *   403 Not the NFT owner, or token already consumed, or wrong video
 *   404 Video not found in catalog
 *   500 Server configuration error
 */

import { NextResponse } from "next/server";
import { PPVServerError, verifyAndServeAccess } from "@/lib/server/ppv-backend";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const debug = process.env.LOG_LEVEL === "debug";

export async function POST(
  request: Request,
  { params }: { params: { videoId: string } }
) {
  try {
    const pathVideoId = params.videoId;
    if (!pathVideoId || !Number.isFinite(Number(pathVideoId))) {
      return NextResponse.json(
        { status: "error", message: "Invalid videoId in path." },
        { status: 400 }
      );
    }

    const body = (await request.json().catch(() => null)) as
      | {
          tokenId?: string | number;
          viewerAddress?: string;
          viewer?: string;
          consumedAleoRecord?: string;
        }
      | null;

    if (!body) {
      return NextResponse.json(
        { status: "error", message: "Invalid request body." },
        { status: 400 }
      );
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

    // Additional check: ensure NFT matches the requested videoId from the path
    if (result.videoId !== pathVideoId) {
      return NextResponse.json(
        {
          status: "error",
          message: `Token is for video ${result.videoId}, not video ${pathVideoId}.`,
        },
        { status: 403 }
      );
    }

    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof PPVServerError) {
      if (debug) {
        console.error(`[api/watch-gate/${params.videoId}]`, error.message);
      }

      return NextResponse.json(
        { status: "error", message: error.message },
        { status: error.statusCode }
      );
    }

    const message = error instanceof Error ? error.message : "Unknown error. Please try again.";

    if (debug) {
      console.error(`[api/watch-gate/${params.videoId}] unexpected error`, error);
    }

    return NextResponse.json({ status: "error", message }, { status: 500 });
  }
}
