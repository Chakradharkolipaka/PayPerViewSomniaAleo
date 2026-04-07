#!/usr/bin/env node

/**
 * scripts/encrypt-video.mjs
 * Encrypts a local MP4 video with AES-256-CBC.
 *
 * The encryption key is deterministically derived from PPV_MASTER_KEY + videoId,
 * so no per-video DECRYPTION_KEY env entries are required.
 *
 * Usage:
 *   node scripts/encrypt-video.mjs my-video.mp4 2024
 *
 * Output:
 *   - Encrypted: public/encrypted/video_2024.enc (IV + ciphertext)
 *   - Deterministic key derivation fingerprint (for sanity check)
 *
 * Workflow:
 *   1. Run this script for each video during deployment prep
 *   2. Copy encrypted blobs to public/encrypted/ (auto-done here)
 *   3. Ensure PPV_MASTER_KEY is set in server environment
 *   4. On purchase, backend derives the same key and serves it to frontend
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

function deriveVideoKey(videoIdValue, masterKey) {
  return crypto
    .createHmac("sha256", masterKey)
    .update(`ppv:${videoIdValue}`)
    .digest();
}

// Parse args
const [videoFile, videoId] = process.argv.slice(2);
if (!videoFile || !videoId) {
  console.error("Usage: node scripts/encrypt-video.mjs <video.mp4> <videoId>");
  process.exit(1);
}

// Validate file exists
const videoPath = path.resolve(videoFile);
if (!fs.existsSync(videoPath)) {
  console.error(`Error: File not found: ${videoPath}`);
  process.exit(1);
}

try {
  const masterKey = process.env.PPV_MASTER_KEY;
  if (!masterKey) {
    console.error(
      "[encrypt-video] Missing PPV_MASTER_KEY. Set it once in your shell or .env.local before encrypting videos."
    );
    process.exit(1);
  }

  // 1. Read video bytes
  const videoBuffer = fs.readFileSync(videoPath);
  console.error(`[encrypt-video] Read ${videoBuffer.length} bytes from ${videoFile}`);

  // 2. Generate random IV (16 bytes) and derive deterministic key (32 bytes)
  const iv = crypto.randomBytes(16);
  const key = deriveVideoKey(videoId, masterKey);

  // 3. Encrypt with AES-256-CBC
  const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);
  let encrypted = cipher.update(videoBuffer);
  encrypted = Buffer.concat([encrypted, cipher.final()]);

  // 4. Prepend IV to ciphertext (IV will be extracted by decryptAndPlay)
  const encryptedWithIv = Buffer.concat([iv, encrypted]);

  // 5. Create public/encrypted/ if needed
  const encryptedDir = path.resolve(projectRoot, "public", "encrypted");
  if (!fs.existsSync(encryptedDir)) {
    fs.mkdirSync(encryptedDir, { recursive: true });
    console.error(`[encrypt-video] Created directory: ${encryptedDir}`);
  }

  // 6. Write encrypted file
  const encryptedFile = path.resolve(encryptedDir, `video_${videoId}.enc`);
  fs.writeFileSync(encryptedFile, encryptedWithIv);
  console.error(
    `[encrypt-video] Wrote encrypted asset: ${encryptedFile} (${encryptedWithIv.length} bytes)`
  );

  const fingerprint = crypto
    .createHash("sha256")
    .update(key)
    .digest("hex")
    .slice(0, 12);
  console.error(`[encrypt-video] Deterministic key fingerprint for video_${videoId}: ${fingerprint}`);
} catch (err) {
  console.error(`[encrypt-video] Error:`, err.message);
  process.exit(1);
}
