# Somnia Private Pay-Per-View (Aleo + Verulink + Next.js)

A dual-chain pay-per-view app where:

- **Aleo (Leo)** stores private encrypted YouTube URLs as records
- **Somnia EVM (Solidity)** handles STT payments, access, and expiry
- **Verulink** relays Aleo ZK proofs to Somnia verifier contracts
- **Next.js App Router** powers UI and API endpoints
- **Node backend worker** listens to events and triggers Aleo/Somnia actions

## Why this architecture

- No plaintext YouTube URL is stored on-chain
- Access is non-transferable and viewer-bound
- Rental access is time-limited (30 days)
- Proof verification is bridged correctly for Aleo ↔ EVM curve mismatch

## Constraint policy (enforced)

- No IPFS usage
- No X402 usage
- Somnia-only Solidity deployment target
- STT native payment only (`msg.value`)
- No permanent purchase model (30-day rental only)
- No backend storage of private/view keys
- No transferability for Aleo access records or AccessNFT

## Project structure

- `aleo/video_access.aleo` — Leo program
- `contracts/AccessNFT.sol` — non-transferable ERC-721 with expiry
- `contracts/PayPerView.sol` — STT rental payments + refund logic
- `contracts/ProofVerifier.sol` — Verulink/Aleo proof verification bridge target
- `src/app/videos/[videoId]/page.tsx` — watch flow (pay → proof → stream)
- `src/app/api/encrypt-url/route.ts` — backend-gated URL encryption endpoint
- `src/app/api/stream/route.ts` — stream entitlement + signed URL endpoint
- `backend/index.mjs` — event worker (payment + access grant orchestration)

## Smart contract events consumed by backend

- `PaymentReceived(address viewer, uint256 videoId, uint256 amount, uint256 expiry)`
- `AccessGranted(address viewer, uint256 videoId, uint256 timestamp)`

## Setup

1. Install dependencies
2. Configure environment variables
3. Compile/test contracts
4. Deploy contracts to Somnia testnet
5. Configure Verulink + Aleo program
6. Run frontend and backend worker

### Required `.env.local` keys (minimum)

- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_SOMNIA_RPC_URL`
- `NEXT_PUBLIC_PAYPERVIEW_ADDRESS`
- `NEXT_PUBLIC_ACCESS_NFT_ADDRESS`
- `NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS`
- `NEXT_PUBLIC_VERULINK_RELAY_URL`
- `STREAM_URL_SIGNING_SECRET`
- `INTERNAL_SERVICE_TOKEN`
- `SOMNIA_RPC_URL`
- `SOMNIA_WS_RPC_URL`
- `BACKEND_OPERATOR_PRIVATE_KEY`
- `VERULINK_ALEO_VERIFIER_ADDRESS`
- `YOUTUBE_URL_VIDEO_1` (and additional IDs as needed)

## Typical dev flow

- Open `/videos/1`
- Pay STT via MetaMask on Somnia
- Backend sees `PaymentReceived`, encrypts URL, submits Aleo `grant_access`, then calls `activateAccess`
- User generates Aleo proof client-side in Leo wallet
- Frontend relays proof via Verulink
- `ProofVerifier.sol` emits `AccessGranted`
- `/api/stream` validates access and returns 15-minute signed URL

## Known limitations (acknowledged)

- First proof generation may take ~1–3 seconds
- Verulink introduces a trusted-relayer surface
- Aleo mainnet interoperability is still maturing (testnet-first)
- Aleo and EVM curves differ (`BLS12-377` vs `BLS12-381`) so native EVM verification is not possible
- YouTube signed URLs are short-lived and must be refreshed
- Somnia is the only supported EVM deployment target

## Security notes

- No plaintext URL should be written to chain or public DB
- `AccessNFT` transfers are blocked by design
- Streaming endpoint validates on-chain access before serving URL
- Access expiry must be valid in both Aleo proof context and Somnia state

## Cleanup notes

Legacy donation/mint/IPFS flows are intentionally deprecated and replaced by this architecture.

