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
- `NEXT_PUBLIC_ALEO_PROGRAM_ID`
- `SOMNIA_RPC_URL`
- `BACKEND_PRIVATE_KEY`
- `ACCESS_NFT_ADDRESS`
- `PPV_MASTER_KEY`

Optional (if using `/api/content` metadata endpoint):

- `ENCRYPTED_ASSET_VIDEO_1`
- `ENCRYPTED_ASSET_VIDEO_2`

## Commands

- `npm run contracts:compile`
- `npm run contracts:test`
- `npm run contracts:deploy:somnia`
- `npm run dev`

## Leo Wallet Connection Recovery (Aleo Testnet Beta)

Use this flow when Leo Wallet appears configured but app connection fails due to stale authorization state.

### Current vs Desired Status

- Current (broken): Leo Wallet shows `testnetbeta` and an account, but dApps authorization state is stale/corrupted and connect handshakes fail.
- Desired (healthy): App connects to Leo Wallet on `testnetbeta`, returns a valid `aleo1...` address, and shows actionable UI guidance for every failure mode.

### Manual Wallet-Side Recovery (must be done in order)

1. Leo Wallet -> Settings -> dApps: ensure `Allow dApps to connect` is ON.
2. Leo Wallet -> Connected Sites (Authorized dApps): remove this app's domain entry (`localhost:3000` or deployed domain).
3. If faucet authorization was created while dApps interaction was OFF, remove `https://faucet.aleo.org` and re-authorize later.
4. Leo Wallet network selector: confirm `Aleo Testnet Beta` (`testnetbeta`).
5. Hard-reload the app tab (`Ctrl+Shift+R` / `Cmd+Shift+R`).

### Implemented App Hardening

- Extension detection waits up to 3 seconds before classifying `not_installed`.
- Connection errors are classified into: `not_installed`, `dapps_disabled`, `wrong_network`, `user_rejected`, `stale_auth`, `unknown`.
- Network check is strict and case-sensitive: wallet network must equal `testnetbeta`.
- Returned address must be present and start with `aleo1`; otherwise it is treated as `stale_auth`.
- Debug logs are emitted for provider presence, requested network, raw wallet error, and classification.
- Mid-session extension disappearance is detected by polling every 2 seconds.

### User-Facing Error Contract

- UI only shows mapped, actionable messages from centralized connection-message metadata.
- Raw JavaScript errors are not surfaced directly to users.
- Retry-capable errors include this explicit fallback hint:
  - `If this persists, please hard-reload the page (Ctrl+Shift+R).`
