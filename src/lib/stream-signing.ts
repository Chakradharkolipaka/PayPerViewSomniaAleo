import crypto from "crypto";

export function createSignedYoutubeUrl(baseUrl: string, ttlSeconds = 900) {
  const secret = process.env.STREAM_URL_SIGNING_SECRET;
  if (!secret) {
    throw new Error("STREAM_URL_SIGNING_SECRET is not configured.");
  }

  const expiresAt = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = `${baseUrl}|${expiresAt}`;
  const sig = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  const separator = baseUrl.includes("?") ? "&" : "?";

  return {
    signedUrl: `${baseUrl}${separator}exp=${expiresAt}&sig=${sig}`,
    expiresAt,
  };
}
