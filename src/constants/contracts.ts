export const payPerViewAddress = process.env.NEXT_PUBLIC_PAYPERVIEW_ADDRESS as `0x${string}` | undefined;
export const accessNftAddress = process.env.NEXT_PUBLIC_ACCESS_NFT_ADDRESS as `0x${string}` | undefined;
export const proofVerifierAddress = process.env.NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS as `0x${string}` | undefined;

export const payPerViewAbi = [
  {
    type: "function",
    name: "videoPrice",
    stateMutability: "view",
    inputs: [{ name: "videoId", type: "uint256" }],
    outputs: [{ name: "", type: "uint256" }],
  },
  {
    type: "function",
    name: "payForVideo",
    stateMutability: "payable",
    inputs: [{ name: "videoId", type: "uint256" }],
    outputs: [],
  },
  {
    type: "function",
    name: "hasActiveAccess",
    stateMutability: "view",
    inputs: [
      { name: "viewer", type: "address" },
      { name: "videoId", type: "uint256" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "PaymentReceived",
    inputs: [
      { indexed: true, name: "viewer", type: "address" },
      { indexed: true, name: "videoId", type: "uint256" },
      { indexed: false, name: "amount", type: "uint256" },
      { indexed: false, name: "expiry", type: "uint256" },
    ],
    anonymous: false,
  },
] as const;

export const proofVerifierAbi = [
  {
    type: "function",
    name: "verifyAndStream",
    stateMutability: "nonpayable",
    inputs: [
      { name: "aleoProof", type: "bytes" },
      { name: "videoId", type: "uint256" },
      { name: "viewer", type: "address" },
    ],
    outputs: [{ name: "", type: "bool" }],
  },
  {
    type: "event",
    name: "AccessGranted",
    inputs: [
      { indexed: true, name: "viewer", type: "address" },
      { indexed: true, name: "videoId", type: "uint256" },
      { indexed: false, name: "timestamp", type: "uint256" },
    ],
    anonymous: false,
  },
] as const;

export const accessNftAbi = [
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
] as const;
