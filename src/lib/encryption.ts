import crypto from "crypto";

function keyFromAleoAddress(aleoAddress: string): Buffer {
  return crypto.createHash("sha256").update(aleoAddress).digest();
}

function toU128DecimalChunks(data: Buffer): string[] {
  const chunks = new Array<string>(4).fill("0");
  const maxBytes = 64;
  const source = data.length > maxBytes ? data.subarray(0, maxBytes) : Buffer.concat([data, Buffer.alloc(maxBytes - data.length)]);

  for (let i = 0; i < 4; i++) {
    const part = source.subarray(i * 16, i * 16 + 16);
    chunks[i] = BigInt(`0x${part.toString("hex") || "0"}`).toString(10);
  }

  return chunks;
}

function fromU128DecimalChunks(chunks: string[]): Buffer {
  const buffers = chunks.map((chunk) => {
    const hex = BigInt(chunk).toString(16).padStart(32, "0");
    return Buffer.from(hex, "hex");
  });

  return Buffer.concat(buffers);
}

export function encryptYoutubeUrlForAleo(url: string, viewerAleoAddress: string): string[] {
  const key = keyFromAleoAddress(viewerAleoAddress);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  const encrypted = Buffer.concat([cipher.update(url, "utf8"), cipher.final()]);

  const payload = Buffer.concat([iv, encrypted]);
  return toU128DecimalChunks(payload);
}

export function decryptYoutubeUrlFromAleoChunks(chunks: string[], viewerAleoAddress: string): string {
  const key = keyFromAleoAddress(viewerAleoAddress);
  const payload = fromU128DecimalChunks(chunks);

  const iv = payload.subarray(0, 16);
  const encrypted = payload.subarray(16).filter((byte) => byte !== 0);

  const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
  const decrypted = Buffer.concat([decipher.update(Buffer.from(encrypted)), decipher.final()]);
  return decrypted.toString("utf8");
}
