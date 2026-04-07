/**
 * POST /api/proof-verify
 *
 * Verifies an Aleo ViewToken record (proof of paid access).
 * Accepts a serialised Aleo record and returns whether it is valid.
 *
 * Request body (JSON):
 *   { record: string, programId?: string }
 *
 * Responses:
 *   200 { valid: true,  message: "Proof verified." }
 *   200 { valid: false, message: "Invalid or malformed proof." }
 *   400 Missing required fields
 *
 * Implementation note:
 *   Full cryptographic verification requires an Aleo node or SDK.
 *   This stub accepts any non-empty record string as valid so the
 *   frontend flow can operate end-to-end during development.
 *   Replace the body of verifyAleoRecord() with a real SDK call
 *   once ALEO_SEED_PHRASE and an Aleo RPC endpoint are available.
 */

import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Verify an Aleo ViewToken record.
 *
 * @param record    - Serialised Aleo record ciphertext returned by grant_view / consume_view
 * @param programId - Aleo program ID (defaults to NEXT_PUBLIC_ALEO_PROGRAM_ID)
 * @returns         - { valid: boolean, message: string }
 */
function verifyAleoRecord(
  record: string,
  _programId: string
): { valid: boolean; message: string } {
  // Minimal structural validation: Aleo records are non-empty strings.
  // Production implementations should call the Aleo SDK to verify the proof
  // using the verifier key associated with the deployed program.
  if (!record || typeof record !== "string" || record.trim().length === 0) {
    return { valid: false, message: "Invalid or malformed proof." };
  }

  return { valid: true, message: "Proof verified." };
}

export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as
    | { record?: string; programId?: string }
    | null;

  if (!body) {
    return NextResponse.json(
      { status: "error", message: "Invalid request body." },
      { status: 400 }
    );
  }

  const { record, programId } = body;

  if (!record) {
    return NextResponse.json(
      { status: "error", message: "record is required." },
      { status: 400 }
    );
  }

  const resolvedProgramId =
    programId ||
    process.env.NEXT_PUBLIC_ALEO_PROGRAM_ID ||
    "video_access_testnet";

  const result = verifyAleoRecord(record, resolvedProgramId);

  return NextResponse.json(result);
}
