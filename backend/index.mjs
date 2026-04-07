/**
 * backend/index.mjs
 * Minimal PayPerView backend.
 *
 * Responsibilities:
 *   POST /api/verify-and-serve  →  check NFT, return decryption key, burn NFT
 *   GET  /api/video-meta/:id    →  public video metadata (title, thumbnail, price)
 *
 * DEBUG: Set LOG_LEVEL=debug in env to see all verification steps.
 */

import express from "express";
import { ethers } from "ethers";

const app = express();
app.use(express.json());

const DEBUG = process.env.LOG_LEVEL === "debug";
const log = (...args) => DEBUG && console.debug("[backend]", ...args);

// Somnia RPC + contracts
const provider = new ethers.JsonRpcProvider(process.env.SOMNIA_RPC_URL);
const backendWallet = new ethers.Wallet(process.env.BACKEND_PRIVATE_KEY, provider);

// Minimal AccessNFT interface for backend
const accessNFTAbi = [
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function consumed(uint256 tokenId) external view returns (bool)",
  "function tokenVideo(uint256 tokenId) external view returns (uint256)",
  "function consumeAccess(uint256 tokenId) external",
];

const nftContract = new ethers.Contract(
  process.env.ACCESS_NFT_ADDRESS,
  accessNFTAbi,
  backendWallet
);

/**
 * POST /api/verify-and-serve
 * Body: { tokenId: number, viewerAddress: string, consumedAleoRecord: string }
 *
 * POPUP STATES returned to frontend:
 *   status: "verifying"   → "Verifying your access token..."
 *   status: "serving"     → "Unlocking content..."
 *   status: "consumed"    → "View started. Enjoy!"
 *   status: "error"       → show error.message to user
 */
app.post("/api/verify-and-serve", async (req, res) => {
  const { tokenId, viewerAddress, consumedAleoRecord } = req.body;

  log("verify-and-serve request", { tokenId, viewerAddress });

  try {
    // 1. Confirm NFT owner on Somnia
    const owner = await nftContract.ownerOf(tokenId);
    log("NFT owner", owner);

    if (owner.toLowerCase() !== viewerAddress.toLowerCase()) {
      return res.status(403).json({
        status: "error",
        message: "You do not own this access token. Please purchase first.",
      });
    }

    // 2. Confirm token is not already consumed
    const alreadyConsumed = await nftContract.consumed(tokenId);
    if (alreadyConsumed) {
      return res.status(403).json({
        status: "error",
        message: "This access token has already been used. Purchase again to watch.",
      });
    }

    // 3. Return encrypted content decryption key
    //    In production: keys stored in a secrets manager, one per videoId
    const videoId = await nftContract.tokenVideo(tokenId);
    const decryptionKey = process.env[`DECRYPTION_KEY_VIDEO_${videoId}`];

    if (!decryptionKey) {
      return res.status(500).json({
        status: "error",
        message: "Content key not found. Contact support.",
      });
    }

    log("serving decryption key for video", videoId.toString());

    // 4. Burn the NFT (consume access) — fire and forget
    nftContract.consumeAccess(tokenId).catch((err) => {
      console.error("[backend] NFT burn failed", err.message);
      // Non-fatal: key was already served. Log for manual reconciliation.
    });

    return res.json({
      status: "consumed",
      decryptionKey,
      videoId: videoId.toString(),
    });
  } catch (err) {
    log("verify-and-serve error", err.message);
    return res.status(500).json({
      status: "error",
      message: err.message || "Unknown error. Please try again.",
    });
  }
});

/**
 * GET /api/video-meta/:id
 * Returns public metadata only — no keys, no URLs.
 */
app.get("/api/video-meta/:id", (req, res) => {
  const id = parseInt(req.params.id);
  const meta = VIDEO_CATALOG[id];
  if (!meta) return res.status(404).json({ message: "Video not found" });
  return res.json(meta);
});

// Public video catalog — titles and thumbnails only
const VIDEO_CATALOG = {
  1: {
    title: "Introduction to Zero-Knowledge Proofs",
    thumbnail: "/thumbnails/1.jpg",
    priceSTT: "0.005",
  },
  2: {
    title: "Aleo Privacy Deep Dive",
    thumbnail: "/thumbnails/2.jpg",
    priceSTT: "0.005",
  },
};

app.listen(process.env.PORT || 3001, () =>
  console.log("[backend] PayPerView backend running on port", process.env.PORT || 3001)
);
