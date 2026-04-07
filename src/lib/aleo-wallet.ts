/**
 * src/lib/aleo-wallet.ts
 * Wrapper around Aleo SDK for ViewToken lifecycle (grant_view / consume_view).
 *
 * Transitions:
 *   - grant_view(viewer: address, video_id: u32, token_id: u256) → ViewToken record
 *   - consume_view(token: ViewToken) → consumed ViewToken record
 *
 * DEBUG: Check browser console if transitions fail.
 */

/**
 * grantViewToken
 * Calls grant_view transition to create a ViewToken for the viewer + video_id + token_id.
 * This happens after on-chain payment (PayPerView.pay) mints the AccessNFT.
 *
 * @param programId     - Aleo program ID (e.g., video_access_<network>)
 * @param viewerAddress - Aleo address string
 * @param videoId       - Video identifier (u32)
 * @param tokenId       - Somnia NFT token ID (u256)
 * @returns             - Serialized ViewToken record (to be consumed later)
 *
 * POPUP: "Generating Aleo proof in your wallet — please wait."
 * ERROR: "Aleo proof generation failed — check that your wallet is unlocked and connected."
 */
export async function grantViewToken(
  programId: string,
  viewerAddress: string,
  videoId: number,
  tokenId: bigint
): Promise<string> {
  try {
    // Aleo wallet injected as window.aleo_appName
    const aleoWallet = (window as any).aleo_appName;
    if (!aleoWallet?.requestCiphertext) {
      throw new Error("Aleo wallet not found. Install and unlock the Aleo wallet extension.");
    }

    // Call grant_view via Aleo SDK / Wallet integration
    // The wallet handles the proof internally and returns the record ciphertext
    const record = await aleoWallet.requestCiphertext({
      program: programId,
      transition: "grant_view",
      inputs: [viewerAddress, videoId.toString(), tokenId.toString()],
    });

    console.debug("[aleo-wallet] grantViewToken success", { programId, tokenId, record });
    return record;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[aleo-wallet] grantViewToken failed", msg);
    throw new Error(`Failed to grant view token: ${msg}`);
  }
}

/**
 * consumeViewToken
 * Calls consume_view transition to mark the ViewToken as spent.
 * Backend will submit this proof to complete the purchase.
 *
 * @param programId     - Aleo program ID
 * @param tokenRecord   - Serialized ViewToken record from grantViewToken
 * @returns             - Consumed record proof (for backend verification)
 *
 * POPUP: "Finalising access proof — please wait."
 * ERROR: "Failed to consume proof — check that your wallet is unlocked."
 */
export async function consumeViewToken(programId: string, tokenRecord: string): Promise<string> {
  try {
    const aleoWallet = (window as any).aleo_appName;
    if (!aleoWallet?.requestCiphertext) {
      throw new Error("Aleo wallet not found. Install and unlock the Aleo wallet extension.");
    }

    // Call consume_view on the token
    const consumed = await aleoWallet.requestCiphertext({
      program: programId,
      transition: "consume_view",
      inputs: [tokenRecord],
    });

    console.debug("[aleo-wallet] consumeViewToken success", { consumed });
    return consumed;
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[aleo-wallet] consumeViewToken failed", msg);
    throw new Error(`Failed to consume view token: ${msg}`);
  }
}

