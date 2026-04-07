# Backend Services (Node.js)

This backend is now an event monitor, not a YouTube/encryption orchestrator.

## Responsibilities

1. Subscribe to `AccessPurchased` from `PayPerView.sol`
2. Subscribe to `ViewAccessConsumed` from `ProofVerifier.sol`
3. Print structured logs for operational visibility and debugging

## Environment Variables

- `SOMNIA_RPC_URL`
- `SOMNIA_WS_RPC_URL`
- `NEXT_PUBLIC_PAYPERVIEW_ADDRESS`
- `NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS`

## Notes

- No YouTube URL processing exists in backend.
- No encrypted URL generation or signing exists in backend.
- No private content keys are persisted.
