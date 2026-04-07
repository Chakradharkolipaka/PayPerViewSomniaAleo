# Backend Services (Node.js)

Minimal backend for the PPV flow.

## Responsibilities

1. Verify `ownerOf(tokenId)` on `AccessNFT.sol`
2. Ensure `consumed(tokenId) == false`
3. Return `DECRYPTION_KEY_VIDEO_<id>` for allowed viewers
4. Consume access by calling `consumeAccess(tokenId)`

## Environment Variables

- `SOMNIA_RPC_URL`
- `BACKEND_PRIVATE_KEY`
- `ACCESS_NFT_ADDRESS`
- `DECRYPTION_KEY_VIDEO_1` (and more as needed)
- `PORT` (optional)
- `LOG_LEVEL` (optional, set to `debug` for verbose logs)

## Notes

- No YouTube URL processing exists in backend.
- No ProofVerifier dependency exists in backend.
