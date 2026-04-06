import { ethers } from "ethers";
import crypto from "crypto";
import { submitGrantAccessToAleo } from "./aleo-client.mjs";

const rpcUrl = process.env.SOMNIA_RPC_URL || "https://dream-rpc.somnia.network/";
const wsRpcUrl = process.env.SOMNIA_WS_RPC_URL || rpcUrl;
const privateKey = process.env.BACKEND_OPERATOR_PRIVATE_KEY;
const aleoMockMode = (process.env.ALEO_MOCK_MODE || "true").toLowerCase() === "true";

const payPerViewAddress = process.env.NEXT_PUBLIC_PAYPERVIEW_ADDRESS;
const proofVerifierAddress = process.env.NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS;

if (!privateKey || !payPerViewAddress || !proofVerifierAddress) {
  console.error("Missing backend env vars: BACKEND_OPERATOR_PRIVATE_KEY/NEXT_PUBLIC_PAYPERVIEW_ADDRESS/NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS");
  process.exit(1);
}

const provider = new ethers.JsonRpcProvider(rpcUrl);
const wsProvider = new ethers.WebSocketProvider(wsRpcUrl);
const signer = new ethers.Wallet(privateKey, provider);

const payPerViewAbi = [
  "event PaymentReceived(address indexed viewer, uint256 indexed videoId, uint256 amount, uint256 expiry)",
  "function activateAccess(address viewer, uint256 videoId) external returns (uint256)",
];

const proofVerifierAbi = [
  "event AccessGranted(address indexed viewer, uint256 indexed videoId, uint256 timestamp)",
];

const payPerView = new ethers.Contract(payPerViewAddress, payPerViewAbi, signer);
const proofVerifier = new ethers.Contract(proofVerifierAddress, proofVerifierAbi, wsProvider);

const accessEventCache = new Map();

function key(viewer, videoId) {
  return `${viewer.toLowerCase()}:${videoId.toString()}`;
}

function encryptYoutubeUrl(youtubeUrl, aleoAddress) {
  const aesKey = crypto.createHash("sha256").update(aleoAddress).digest();
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv("aes-256-cbc", aesKey, iv);
  const encrypted = Buffer.concat([cipher.update(youtubeUrl, "utf8"), cipher.final()]);
  const payload = Buffer.concat([iv, encrypted]);

  const chunks = [];
  const padded = payload.length > 64 ? payload.subarray(0, 64) : Buffer.concat([payload, Buffer.alloc(64 - payload.length)]);

  for (let i = 0; i < 4; i++) {
    const chunkBytes = padded.subarray(i * 16, i * 16 + 16);
    chunks.push(BigInt(`0x${chunkBytes.toString("hex") || "0"}`).toString());
  }

  return chunks;
}

async function grantAleoAccess({ viewerAleoAddress, videoId, encryptedUrlChunks }) {
  if (aleoMockMode) {
    console.warn("⚠️ ALEO_MOCK_MODE=true, using synthetic Aleo tx hash");
    return {
      txHash: `aleo_mock_${Date.now()}_${viewerAleoAddress.slice(0, 10)}_${videoId}`,
    };
  }

  return submitGrantAccessToAleo({
    viewerAleoAddress,
    videoId,
    encryptedUrlChunks,
  });
}

function getYoutubeUrlForVideo(videoId) {
  return process.env[`YOUTUBE_URL_VIDEO_${videoId}`];
}

payPerView.on("PaymentReceived", async (viewer, videoId, amount, expiry, event) => {
  try {
    console.log("PaymentReceived:", { viewer, videoId: videoId.toString(), amount: amount.toString(), expiry: expiry.toString(), tx: event.log.transactionHash });

    const viewerAleoAddress = process.env[`VIEWER_ALEO_ADDRESS_${viewer.toLowerCase()}`];
    if (!viewerAleoAddress) {
      console.warn(`Missing viewer Aleo address mapping for ${viewer}`);
      return;
    }

    const youtubeUrl = getYoutubeUrlForVideo(videoId.toString());
    if (!youtubeUrl) {
      console.warn(`Missing YOUTUBE_URL_VIDEO_${videoId.toString()}`);
      return;
    }

    const encryptedUrlChunks = encryptYoutubeUrl(youtubeUrl, viewerAleoAddress);

    const aleoGrant = await grantAleoAccess({
      viewerAleoAddress,
      videoId: videoId.toString(),
      encryptedUrlChunks,
    });

    console.log("Aleo grant_access tx:", aleoGrant.txHash);

    const tx = await payPerView.activateAccess(viewer, videoId);
    await tx.wait();
    console.log("Access activated on Somnia:", tx.hash);
  } catch (err) {
    console.error("Failed payment processing:", err);
  }
});

proofVerifier.on("AccessGranted", (viewer, videoId, timestamp) => {
  const cacheKey = key(viewer, videoId);
  accessEventCache.set(cacheKey, {
    timestamp: Number(timestamp),
    observedAt: Date.now(),
  });
  console.log("AccessGranted cached:", cacheKey);
});

console.log("Backend listeners started.");
console.log(`HTTP RPC: ${rpcUrl}`);
console.log(`WS RPC: ${wsRpcUrl}`);
