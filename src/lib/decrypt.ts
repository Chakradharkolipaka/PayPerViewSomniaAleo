/**
 * src/lib/decrypt.ts
 * Client-side decryption for encrypted static content.
 *
 * Downloads encrypted asset, decrypts with AES-256-CBC key from backend,
 * and creates a blob URL for the <video> element.
 */

/**
 * decryptAndPlay
 * Downloads the encrypted asset from /public/encrypted/, decrypts with Web Crypto API,
 * and returns an object URL for video playback.
 *
 * @param videoId    - Video identifier (must match backend DECRYPTION_KEY_VIDEO_<id>)
 * @param hexKey     - Hex-encoded key from backend (256 bits = 64 hex chars)
 * @returns          - Object URL for <video src={...}>
 *
 * POPUP: "Decrypting content — this only takes a moment."
 * ERROR: "Decryption failed — the key or asset may be corrupted. Contact support."
 */
export async function decryptAndPlay(
  videoId: string,
  hexKey: string
): Promise<string> {
  try {
    // 1. Fetch encrypted asset
    const encryptedRes = await fetch(`/encrypted/video_${videoId}.enc`);
    if (!encryptedRes.ok) {
      throw new Error(`Failed to download encrypted asset: ${encryptedRes.status}`);
    }
    const encryptedBuffer = await encryptedRes.arrayBuffer();

    // 2. Extract IV (first 16 bytes) and ciphertext (remainder)
    const ivBytes = encryptedBuffer.slice(0, 16);
    const data = encryptedBuffer.slice(16);
    const keyBytes = hexToBuffer(hexKey);

    // 3. Import key into Web Crypto API
    const cryptoKey = await crypto.subtle.importKey(
      "raw",
      keyBytes,
      { name: "AES-CBC" },
      false,
      ["decrypt"]
    );

    // 4. Decrypt
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-CBC", iv: ivBytes },
      cryptoKey,
      data
    );

    // 5. Create blob URL
    const blob = new Blob([decrypted], { type: "video/mp4" });
    return URL.createObjectURL(blob);
  } catch (err) {
    throw new Error(
      `Decryption failed: ${err instanceof Error ? err.message : 'Unknown error'}`
    );
  }
}

/**
 * hexToBuffer
 * Converts a hex string to ArrayBuffer.
 * Example: "48656c6c6f" → [0x48, 0x65, 0x6c, 0x6c, 0x6f]
 */
function hexToBuffer(hex: string): ArrayBuffer {
  if (hex.length % 2 !== 0) {
    throw new Error("Hex string must have even length");
  }
  const buffer = new ArrayBuffer(hex.length / 2);
  const arr = new Uint8Array(buffer);
  for (let i = 0; i < hex.length; i += 2) {
    arr[i / 2] = parseInt(hex.slice(i, i + 2), 16);
  }
  return buffer;
}
