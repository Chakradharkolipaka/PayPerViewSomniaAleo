#!/usr/bin/env node

/**
 * scripts/encrypt-video.mjs
 * Encrypts a local MP4 video with AES-256-CBC and outputs hex-encoded key.
 *
 * Usage:
 *   node scripts/encrypt-video.mjs my-video.mp4 2024
 *
 * Output:
 *   - Encrypted: public/encrypted/video_2024.enc (IV + ciphertext)
 *   - Key: Printed to stdout for backend DECRYPTION_KEY_VIDEO_<id> env var
 *
 * Workflow:
 *   1. Run this script for each video during deployment prep
 *   2. Copy encrypted blobs to public/encrypted/ (auto-done here)
 *   3. Set backend env vars: DECRYPTION_KEY_VIDEO_2024=<hex-key>
 *   4. On purchase, backend serves the hex key; frontend decrypts with decryptAndPlay()
 */

import fs from "fs";
import path from "path";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "..");

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
  // 1. Read video bytes
  const videoBuffer = fs.readFileSync(videoPath);
  console.error(`[encrypt-video] Read ${videoBuffer.length} bytes from ${videoFile}`);

  // 2. Generate random IV (16 bytes) and key (32 bytes)
  const iv = crypto.randomBytes(16);
  const key = crypto.randomBytes(32);

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

  // 7. Output hex key (backend will store this in DECRYPTION_KEY_VIDEO_<id>)
  const hexKey = key.toString("hex");
  console.log(hexKey);

  console.error(
    `[encrypt-video] Key for backend env: DECRYPTION_KEY_VIDEO_${videoId}=${hexKey}`
  );
} catch (err) {
  console.error(`[encrypt-video] Error:`, err.message);
  process.exit(1);
}
