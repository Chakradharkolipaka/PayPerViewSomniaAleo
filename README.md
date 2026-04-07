# Somnia + Aleo One-Time Pay-Per-View

This app implements a fixed-price, single-view architecture:

- User pays exactly `0.005 STT` on Somnia
- Payment mints one non-transferable single-use access NFT
- Aleo generates privacy proof + per-view key handoff
- Proof verification on Somnia consumes (burns) the NFT
- Next.js route handlers serve verification and video metadata on the same deployment
- Frontend loads encrypted static asset metadata (no YouTube URLs)

## Core Design

### On Somnia

- `PayPerView.sol`
  - Fixed `PRICE = 0.005 ether`
  - `pay(videoId)` mints one access NFT immediately
- `AccessNFT.sol`
  - Non-transferable single-use token
  - `consumeAccess(tokenId)` burns token after successful verification

### On Aleo

- `aleo/video_access.aleo`
  - Issues one-time view tokens
  - Supports token consumption flow
  - Carries per-view authorization data (not YouTube URL)

### Frontend

- `/videos/[videoId]` provides a clear 4-step UX:
  - Connect wallet
  - Pay `0.005 STT`
  - Get access
  - Start viewing
- Includes:
  - Wallet balance checks
  - Toast notifications for each major step
  - Tx hash links to explorer
  - Development debug toggle

### Content Delivery

- Encrypted static asset URLs are provided via `/api/content?videoId=<id>`
- Set `ENCRYPTED_ASSET_VIDEO_<ID>` in environment
- Client-side decryption pipeline is intentionally pluggable

## Removed

- YouTube URL encryption model
- `/api/stream`
- `/api/encrypt-url`
- `src/lib/stream-signing.ts`
- `src/lib/encryption.ts`

## Required `.env.local` keys

- `NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID`
- `NEXT_PUBLIC_SOMNIA_RPC_URL`
- `NEXT_PUBLIC_PAYPERVIEW_ADDRESS`
- `NEXT_PUBLIC_ACCESS_NFT_ADDRESS`
- `SOMNIA_RPC_URL`
- `BACKEND_PRIVATE_KEY`
- `ACCESS_NFT_ADDRESS`
- `ALEO_PROGRAM_ID`
- `ALEO_PRIVATE_KEY`
- `ALEO_RPC_URL`
- `ALEO_NETWORK`
- `ENCRYPTED_ASSET_VIDEO_1`

## Commands

- `npm run contracts:compile`
- `npm run contracts:test`
- `npm run contracts:deploy:somnia`
- `npm run dev`
