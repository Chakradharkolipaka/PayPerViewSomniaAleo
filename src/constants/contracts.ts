/**
 * src/constants/contracts.ts
 * Contract addresses and ABIs for the minimal PPV architecture.
 * 
 * ProofVerifier and MockAleoVerifier are no longer used in production.
 * Verification now happens entirely in the backend via /api/verify-and-serve.
 */

export const payPerViewAddress = process.env.NEXT_PUBLIC_PAYPERVIEW_ADDRESS as `0x${string}` | undefined;
export const accessNftAddress = process.env.NEXT_PUBLIC_ACCESS_NFT_ADDRESS as `0x${string}` | undefined;

// Network configuration
export const SOMNIA_CHAIN_ID = 102;
export const SOMNIA_RPC = process.env.NEXT_PUBLIC_RPC_URL || "https://somnia-testnet-rpc.allthatnode.com:8545";
export const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

// Constants
export const VIDEO_PRICE_STT = "0.005";
export const VIDEO_PRICE_WEI = BigInt("5000000000000000"); // 0.005 STT in wei

// PayPerView ABI
export const payPerViewAbi = [
  {
    type: "function",
    name: "PRICE",
    stateMutability: "view",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "pay",
    stateMutability: "payable",
    inputs: [{ name: "videoId", type: "uint256" }],
    outputs: [{ name: "tokenId", type: "uint256" }],
  },
  {
    type: "event",
    name: "PaymentReceived",
    inputs: [
      { indexed: true, name: "buyer", type: "address" },
      { indexed: true, name: "videoId", type: "uint256" },
      { indexed: false, name: "tokenId", type: "uint256" },
    ],
    anonymous: false,
  },
  {
    type: "event",
    name: "AccessMinted",
    inputs: [
      { indexed: true, name: "buyer", type: "address" },
      { indexed: true, name: "videoId", type: "uint256" },
      { indexed: false, name: "tokenId", type: "uint256" },
    ],
    anonymous: false,
  },
] as const;

// AccessNFT ABI
export const accessNftAbi = [
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "consumed",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "function",
    name: "tokenVideo",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
] as const;
