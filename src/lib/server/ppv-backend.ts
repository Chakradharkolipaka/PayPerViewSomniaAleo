import { ethers } from "ethers";

type VideoMeta = {
  title: string;
  thumbnail: string;
  priceSTT: string;
};

export class PPVServerError extends Error {
  statusCode: number;

  constructor(statusCode: number, message: string) {
    super(message);
    this.name = "PPVServerError";
    this.statusCode = statusCode;
  }
}

const VIDEO_CATALOG: Record<number, VideoMeta> = {
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

export function getVideoMeta(videoId: number): VideoMeta | undefined {
  return VIDEO_CATALOG[videoId];
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
  const decryptionKey = process.env[`DECRYPTION_KEY_VIDEO_${videoId}`];

  if (!decryptionKey) {
    throw new PPVServerError(500, "Content key not found. Contact support.");
  }

  const burnTx = await contract.consumeAccess(tokenId);
  await burnTx.wait();

  return {
    status: "consumed" as const,
    decryptionKey,
    videoId: videoId.toString(),
    consumedAleoRecord: input.consumedAleoRecord ?? "",
  };
}