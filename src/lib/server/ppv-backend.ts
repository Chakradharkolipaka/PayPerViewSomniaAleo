import { ethers } from "ethers";
import { createHmac } from "crypto";
import { getVideoById } from "@/lib/server/video-catalog";

type VideoMeta = {
  title: string;
  description: string;
  creator: string;
  priceSTT: string;
  encryptedAssetUrl: string;
};

export class PPVServerError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "PPVServerError";
    this.statusCode = statusCode;
  }
}

const accessNftAbi = [
  "function ownerOf(uint256 tokenId) external view returns (address)",
  "function consumed(uint256 tokenId) external view returns (bool)",
  "function tokenVideo(uint256 tokenId) external view returns (uint256)",
  "function consumeAccess(uint256 tokenId) external",
];

function getRpcUrl() {
  return process.env.SOMNIA_RPC_URL || process.env.NEXT_PUBLIC_SOMNIA_RPC_URL;
}

function getAccessNftAddress() {
  return process.env.ACCESS_NFT_ADDRESS || process.env.NEXT_PUBLIC_ACCESS_NFT_ADDRESS;
}

function getBackendPrivateKey() {
  return process.env.BACKEND_PRIVATE_KEY;
}

function getMasterKey() {
  return process.env.PPV_MASTER_KEY;
}

function deriveVideoDecryptionKey(videoId: bigint) {
  const masterKey = getMasterKey();
  if (!masterKey) {
    throw new PPVServerError(500, "Server encryption key is not configured.");
  }

  return createHmac("sha256", masterKey)
    .update(`ppv:${videoId.toString()}`)
    .digest("hex");
}

function getNftContract() {
  const rpcUrl = getRpcUrl();
  const contractAddress = getAccessNftAddress();
  const privateKey = getBackendPrivateKey();

  if (!rpcUrl) {
    throw new PPVServerError(500, "Somnia RPC URL is not configured.");
  }

  if (!contractAddress) {
    throw new PPVServerError(500, "AccessNFT address is not configured.");
  }

  if (!privateKey) {
    throw new PPVServerError(500, "Backend wallet key is not configured.");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  return new ethers.Contract(contractAddress, accessNftAbi, wallet);
}

export async function getVideoMeta(videoId: number): Promise<VideoMeta | undefined> {
  const video = await getVideoById(videoId);
  if (!video) return undefined;

  return {
    title: video.title,
    description: video.description,
    creator: video.creator,
    priceSTT: video.priceSTT,
    encryptedAssetUrl: video.encryptedAssetUrl,
  };
}

export async function verifyAndServeAccess(input: {
  tokenId: string | number | bigint;
  viewerAddress: string;
  consumedAleoRecord?: string;
}) {
  const contract = getNftContract();
  const tokenId = BigInt(input.tokenId);

  if (!ethers.isAddress(input.viewerAddress)) {
    throw new PPVServerError(400, "Invalid viewer address.");
  }

  const viewerAddress = ethers.getAddress(input.viewerAddress);
  const owner = ethers.getAddress(await contract.ownerOf(tokenId));

  if (owner !== viewerAddress) {
    throw new PPVServerError(
      403,
      "You do not own this access token. Please purchase first."
    );
  }

  if (await contract.consumed(tokenId)) {
    throw new PPVServerError(
      403,
      "This access token has already been used. Purchase again to watch."
    );
  }

  const videoId = await contract.tokenVideo(tokenId);
  const videoMeta = await getVideoMeta(Number(videoId));
  if (!videoMeta) {
    throw new PPVServerError(404, "Unsupported video id for this access token.");
  }

  const decryptionKey = deriveVideoDecryptionKey(videoId);

  const burnTx = await contract.consumeAccess(tokenId);
  await burnTx.wait();

  return {
    status: "consumed" as const,
    decryptionKey,
    videoId: videoId.toString(),
    consumedAleoRecord: input.consumedAleoRecord ?? "",
  };
}