# Backend Services (Node.js)

This folder contains the event-driven backend worker for the dual-chain flow.

## Responsibilities

1. Listen for `PaymentReceived` from `PayPerView.sol`
2. Encrypt YouTube URL using buyer Aleo address-derived key
3. Call Aleo `grant_access` (placeholder hook in code)
4. Activate access on Somnia by calling `activateAccess`
5. Listen for `AccessGranted` from `ProofVerifier.sol` and cache event entries in memory

## Environment Variables

- `SOMNIA_RPC_URL`
- `SOMNIA_WS_RPC_URL`
- `BACKEND_OPERATOR_PRIVATE_KEY`
- `NEXT_PUBLIC_PAYPERVIEW_ADDRESS`
- `NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS`
- `YOUTUBE_URL_VIDEO_<ID>` (e.g. `YOUTUBE_URL_VIDEO_1`)
- `VIEWER_ALEO_ADDRESS_<viewer_evm_lowercase>` (mapping source for local test)

> The backend intentionally stores no private/view keys and does not persist plaintext URLs to a DB.
