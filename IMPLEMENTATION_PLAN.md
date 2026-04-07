# Pay-Per-View Implementation Plan

This repository is being shaped into a simple Somnia + Aleo pay-per-view app with:

- one fixed payment of `0.005 STT`
- one minted access NFT per successful payment
- one access burn/consume after verification
- no YouTube URLs anywhere
- clear popup feedback for every major state transition
- debug-friendly route handling and docs

## 1. Contracts

Files to keep as the source of truth:

- [contracts/PayPerView.sol](contracts/PayPerView.sol)
- [contracts/AccessNFT.sol](contracts/AccessNFT.sol)
- [contracts/ProofVerifier.sol](contracts/ProofVerifier.sol)
- [scripts/deploy.js](scripts/deploy.js)
- [scripts/smoke-test.mjs](scripts/smoke-test.mjs)
- [test/unit/payperview.unit.test.js](test/unit/payperview.unit.test.js)
- [test/unit/accessnft.unit.test.js](test/unit/accessnft.unit.test.js)

Target behavior:

- `pay(videoId)` accepts exactly `0.005 STT`
- payment mints one access NFT
- access NFT stores video identity on-chain
- NFT is consumed/burned after successful access verification
- custom errors exist for wrong price, unsupported video, already consumed, unauthorized access, and mint failure
- contract events are used by the frontend for popup confirmations and debug traces

## 2. API Routes

Files to use or extend:

- [src/app/api/verify-and-serve/route.ts](src/app/api/verify-and-serve/route.ts)
- [src/app/api/video-meta/[id]/route.ts](src/app/api/video-meta/[id]/route.ts)
- [src/app/api/content/route.ts](src/app/api/content/route.ts)
- [src/app/api/aleo-storage/upload/route.ts](src/app/api/aleo-storage/upload/route.ts)
- [src/app/api/donations/[tokenId]/route.ts](src/app/api/donations/[tokenId]/route.ts)
- [src/app/api/health/route.ts](src/app/api/health/route.ts) if added

Target behavior:

- metadata route returns the home page video list
- upload route accepts title, description, and `.mp4` only
- upload route does not require a thumbnail or poster image
- watch-gate route verifies wallet ownership and consumption state server-side
- watch-gate route returns a playable/decryption payload only after payment/access checks pass
- health route exposes readiness checks for deployment/debugging
- all routes remain same-origin so Vercel can run as a single project
- all route errors return structured messages compatible with the popup system

## 3. Mint Page

Files to update:

- [src/app/mint/page.tsx](src/app/mint/page.tsx)
- [src/components/PopupBanner.tsx](src/components/PopupBanner.tsx)
- [src/lib/ppv-errors.ts](src/lib/ppv-errors.ts)
- [src/context/wallet-state.tsx](src/context/wallet-state.tsx)

Target behavior:

- user must connect wallet before minting
- form accepts title, description, and `.mp4`
- file validation happens before upload
- upload is routed through the server route
- minting happens only after upload succeeds
- popup states cover wallet connect, file selection, upload progress, upload complete, mint pending, mint confirmed, and mint failure
- after minting, the user returns to the home page or sees the new card immediately

## 4. Home Cards

Files to update:

- [src/app/page.tsx](src/app/page.tsx)
- [src/app/api/video-meta/[id]/route.ts](src/app/api/video-meta/[id]/route.ts)
- [src/components/NFTCard.tsx](src/components/NFTCard.tsx) if reused
- [src/components/SkeletonCard.tsx](src/components/SkeletonCard.tsx)

Target behavior:

- replace hardcoded cards with API/registry-backed cards
- show title, description, creator/owner, price, and watch status
- sort newest minted first by default
- clicking a card routes to the watch page
- include loading, empty, and error states
- debug-friendly card states should explain missing metadata or invalid records

## 5. Watch Gate / Fullscreen Playback

Files to update:

- [src/app/videos/[videoId]/page.tsx](src/app/videos/[videoId]/page.tsx)
- [src/lib/server/ppv-backend.ts](src/lib/server/ppv-backend.ts)
- [src/lib/decrypt.ts](src/lib/decrypt.ts)
- [src/lib/ppv-errors.ts](src/lib/ppv-errors.ts)
- [src/components/PopupBanner.tsx](src/components/PopupBanner.tsx)
- [src/components/DebugPanel.tsx](src/components/DebugPanel.tsx)

Target behavior:

- route viewers to a dedicated watch page
- server checks access before exposing playback
- if payment is missing, show paywall popup plus pay button
- if payment is valid, unlock playback and enter fullscreen mode
- after one successful watch, consume/burn the access NFT
- playback UI must keep states for loading, decrypting, playing, expired access, and access denied

## 6. Workflow Guarantees

Files to keep aligned:

- [src/app/providers.tsx](src/app/providers.tsx)
- [src/context/wallet-state.tsx](src/context/wallet-state.tsx)
- [src/components/DebugPanel.tsx](src/components/DebugPanel.tsx)
- [src/lib/ppv-errors.ts](src/lib/ppv-errors.ts)
- [src/app/videos/[videoId]/page.tsx](src/app/videos/[videoId]/page.tsx)

Target behavior:

- wallet connect always happens before minting or watching
- creator flow is connect -> upload -> mint -> publish card
- viewer flow is connect -> open card -> pay `0.005 STT` -> fullscreen watch once
- no YouTube URL should exist anywhere in the app
- all failures should be classified and shown in popups
- debug panel should stay visible in development for wallet state, route calls, tx hashes, consume status, and watch failures

## 7. Docs / Debugging

Files to update:

- [README.md](README.md)
- [DEPLOYMENT.md](DEPLOYMENT.md)
- [.env.example](.env.example)
- [.env.local.example](.env.local.example)

Target behavior:

- document exact Vercel env vars
- document the mint upload workflow
- document the watch gate semantics
- document the single-view consumption rule
- document health checks and failure states
- remove stale YouTube or legacy backend wording

## Recommended Build Order

1. Contracts
2. API routes
3. Mint page
4. Home cards
5. Watch gate and fullscreen playback
6. Error popup wiring and debug panel
7. Documentation cleanup

## Notes

- Optional thumbnail/poster upload is intentionally excluded.
- The upload flow is MP4-only.
- The existing `PPV_MASTER_KEY` flow should remain the single source for deterministic encryption key derivation.
