# DEPLOYMENT GUIDE

## Overview

This guide walks through deploying the PayPerView (PPV) system across Somnia, Aleo, and Next.js route handlers. All infrastructure has been refactored (Phase 0–6) and is ready for production deployment.

## Architecture Recap

```
User Browser
  ↓ 1. [Wallet Context] Connects Somnia (MetaMask) + Aleo (Aleo SDK)
  ↓ 2. [Watch Page] Sets up 4-step state machine (idle → connecting → paying → ... → playing)
  ↓ 3. [Pay Action] Calls PayPerView.pay(videoId) via wagmi, receives AccessNFT tokenId
  ↓ 4. [Aleo Proof] Calls aleo_appName.grantViewToken(viewer, video_id, token_id)
  ↓ 5. [Route Query] POST /api/verify-and-serve { tokenId, viewer, aleoRecord }
  ↓ 6. [Route Verifies] Checks ownerOf(tokenId) === viewer, not yet consumed
  ↓ 7. [Decryption Key] Route returns hex-encoded AES-256 key
  ↓ 8. [Client Decrypt] Frontend calls decryptAndPlay(videoId, hexKey)
  ↓ 9. [Consume] Frontend calls consumeViewToken(), route burns NFT
  ↓ 10. [Play] <video src={decryptedBlobUrl}> streams to user
```

## Deployment Phases

### Phase A: Smart Contracts (Somnia)

#### Prerequisites
- Somnia RPC URL (testnet or mainnet)
- Deployer wallet with STT for gas fees
- Hardhat project structure (already present)

#### Step 1: Deploy AccessNFT.sol

```bash
# 1.1 Update hardhat.config.js to point to Somnia RPC
# (Check hardhat.config.js for network config; ensure "somnia" or appropriate network is set)

# 1.2 Export private key and RPC URL
export DEPLOYER_PRIVATE_KEY=0x...
export SOMNIA_RPC_URL=https://somnia-testnet-rpc.allthatnode.com:8545

# 1.3 Deploy AccessNFT.sol
npx hardhat run scripts/deploy.js --network somnia --tags AccessNFT

# Output: AccessNFT deployed at 0x<ADDRESS_A>
# → Save this address to .env.local: NEXT_PUBLIC_ACCESS_NFT_ADDRESS=0x<ADDRESS_A>
```

#### Step 2: Deploy PayPerView.sol

```bash
# 2.1 Deploy PayPerView, passing AccessNFT address
npx hardhat run scripts/deploy.js --network somnia --tags PayPerView --access-nft 0x<ADDRESS_A>

# Output: PayPerView deployed at 0x<ADDRESS_B>
# → Save this address to .env.local: NEXT_PUBLIC_PAYPERVIEW_ADDRESS=0x<ADDRESS_B>
```

#### Step 3: Call setMinter()

```bash
# 3.1 Set PayPerView as the minter for AccessNFT
# This allows PayPerView.pay() to mint new access NFTs.
npx hardhat run scripts/configure.js --network somnia \
  --access-nft 0x<ADDRESS_A> \
  --minter 0x<ADDRESS_B>

# Output: setMinter(0x<ADDRESS_B>) called successfully
```

#### Step 4: Verify on Block Explorer

```bash
# 4.1 Upload flattened contracts to Somnia block explorer for verification
# Helps users and auditors understand the contract code.

npx hardhat flatten contracts/AccessNFT.sol > AccessNFT.flat.sol
npx hardhat flatten contracts/PayPerView.sol > PayPerView.flat.sol

# Upload AccessNFT.flat.sol to https://explorer.somnia.network/address/0x<ADDRESS_A>#code
# Upload PayPerView.flat.sol to https://explorer.somnia.network/address/0x<ADDRESS_B>#code
```

### Phase B: Aleo Program Deployment

#### Prerequisites
- Aleo CLI installed: `cargo install aleo`
- Aleo testnet or mainnet PrivateKey for deployment gas
- `aleo/video_access.aleo` program ready

#### Step 1: Deploy to Aleo Testnet

```bash
# B.1 Set up Aleo credentials
aleo account new  # If you don't have a PrivateKey yet
export ALEO_PRIVATE_KEY=APrivateKey1xxx...
export ALEO_NETWORK=testnet  # or "mainnet"

# B.2 Deploy aleo/video_access.aleo
cd aleo
aleo deploy video_access --network $ALEO_NETWORK

# Output: Program deployed: avideoac8qw9v6... (Program ID)
# → Save to .env.local: NEXT_PUBLIC_ALEO_PROGRAM_ID=avideoac8qw9v6...
```

#### Step 2: Record Program Transitions

```bash
# B.2 Confirm available transitions on Aleo Studio:
#     https://api.studio.aleo.org?appName=video_access
#
# Transitions available:
#   - grant_view(viewer: address, video_id: u32, token_id: u256) → ViewToken
#   - consume_view(token: ViewToken) → consumed ViewToken
```

### Phase C: Encrypted Content Preparation

#### Prerequisites
- Original video files (MP4, H.264, AAC)
- `scripts/encrypt-video.mjs` script (Phase 5)

#### Step 1: Encrypt Videos Locally

```bash
# C.1 For each video, encrypt and generate key
node scripts/encrypt-video.mjs my-video.mp4 1

# Output:
#   [encrypt-video] Read 123456789 bytes from my-video.mp4
#   [encrypt-video] Wrote encrypted asset: public/encrypted/video_1.enc (123456890 bytes)
#   [encrypt-video] Deterministic key fingerprint for video_1: 9f3a1c...

# C.2 Ensure PPV_MASTER_KEY is set in app/server env before encryption and runtime.

# C.3 Repeat for all videos (2, 3, 4, ...)
node scripts/encrypt-video.mjs another-video.mp4 2
# → video_2.enc generated with deterministic key derivation

# C.4 Verify encrypted assets in public/encrypted/:
ls -lah public/encrypted/
# video_1.enc  (123456890 bytes)
# video_2.enc  (987654321 bytes)
# ...
```

#### Step 2: Deploy Encrypted Assets to CDN

```bash
# C.5 For production, upload public/encrypted/ to a CDN (e.g., Cloudflare, AWS S3):
#   - Ensure CORS headers allow browser fetch
#   - Set Cache-Control: immutable (content is deterministic, never changes)
#
# Example (AWS S3):
#   aws s3 sync public/encrypted/ s3://my-bucket/encrypted/ \
#     --cache-control "max-age=31536000,immutable"
```

### Phase D: Server Route Handlers

#### Prerequisites
- Node.js v18+
- Next.js API routes in `src/app/api/`
- PPV_MASTER_KEY set

#### Step 2: Set Environment Variables

```bash
# D.1 Use your app-level .env.local or deployment env settings:
export SOMNIA_RPC_URL=https://somnia-testnet-rpc.allthatnode.com:8545
export ACCESS_NFT_ADDRESS=0x<ADDRESS_A>
export PPV_MASTER_KEY=<long-random-secret>

# D.2 Next.js route handlers run inside the main app deployment.
```

#### Step 3: Run the App Locally

```bash
# D.3 Local development:
npm run dev

# Output:
#   Next.js app running on port 3000
#   Listening for POST /api/verify-and-serve and GET /api/video-meta/[id]

# D.4 Production:
# Deploy the Next.js app to Vercel (or your preferred host) with the same env vars.
```

#### Step 4: Verify Route Endpoints

```bash
# D.5 Test /api/video-meta/[id] endpoint:
curl http://localhost:3000/api/video-meta/1

# Expected response:
#   {
#     "videoId": 1,
#     "title": "Introduction to Zero-Knowledge Proofs",
#     "thumbnail": "/thumbnails/1.jpg",
#     "priceSTT": "0.005"
#   }

# D.6 Test /api/verify-and-serve endpoint (after purchasing an NFT):
curl -X POST http://localhost:3000/api/verify-and-serve \
  -H "Content-Type: application/json" \
  -d '{
    "tokenId": "42",
    "viewerAddress": "0x...",
    "consumedAleoRecord": "..."
  }'

# Expected response:
#   {
#     "status": "consumed",
#     "decryptionKey": "a1b2c3d4e5f6...",
#     "videoId": "1"
#   }
```

### Phase E: Frontend Deployment

#### Prerequisites
- All NEXT_PUBLIC_* env vars filled in
- Server route-handler env vars set: `SOMNIA_RPC_URL`, `BACKEND_PRIVATE_KEY`, `ACCESS_NFT_ADDRESS`, `PPV_MASTER_KEY`
- For Vercel production minting with encrypted uploads, set one of: `BLOB_READ_WRITE_TOKEN` or `VERCEL_BLOB_READ_WRITE_TOKEN`
- Build succeeds without errors

#### Step 1: Lint for YouTube URLs

```bash
# E.1 Pre-build check: ensure no YouTube URLs anywhere in code
grep -r "youtube\|youtu\.be\|youtube\.com" src/ components/ pages/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx"

# Output should be EMPTY (no matches)
# If any matches found, remove them before proceeding.
```

#### Step 2: Build Frontend

```bash
# E.2 Build Next.js app
npm run build

# Output:
#   ✓ Compiled successfully
#   ✓ Linked packages (0 modules)
#   ✓ Collected all build files (123 files)
#   ✓ Optimized JS (234 kB)
#   ✓ Optimized CSS (45 kB)
#   Ready in 12.5s

# E.3 Verify no YouTube URLs in output:
grep -r "youtube\|youtu\.be\|youtube\.com" .next/ public/ --include="*.js" --include="*.html" || echo "✓ No YouTube URLs found"
```

#### Step 3: Deploy to Vercel (or similar)

```bash
# E.4 Set environment variables in Vercel dashboard:
# NEXT_PUBLIC_RPC_URL=https://somnia-testnet-rpc.allthatnode.com:8545
# NEXT_PUBLIC_CHAIN_ID=102
# NEXT_PUBLIC_ACCESS_NFT_ADDRESS=0x<ADDRESS_A>
# NEXT_PUBLIC_PAYPERVIEW_ADDRESS=0x<ADDRESS_B>
# NEXT_PUBLIC_ALEO_PROGRAM_ID=avideoac8qw9v6...
# NEXT_PUBLIC_DEBUG=false
# SOMNIA_RPC_URL=https://somnia-testnet-rpc.allthatnode.com:8545
# BACKEND_PRIVATE_KEY=0x<BACKEND_KEY>
# ACCESS_NFT_ADDRESS=0x<ADDRESS_A>
# PPV_MASTER_KEY=<long-random-secret>
# BLOB_READ_WRITE_TOKEN=<vercel-blob-read-write-token>

# E.5 Deploy:
vercel deploy --prod

# Output:
#   Deployed to https://payperview.example.com
```

### Phase F: End-to-End Testing

#### Test Scenario 1: Full Purchase & Playback Flow

```bash
# F.1 User connects MetaMask (Somnia) + Aleo wallet
# Expected: wallet addresses display in debug panel

# F.2 User navigates to /videos/1
# Expected: Video metadata loads (no video plays yet)

# F.3 User clicks "Watch Now"
# Expected: ViewStep → "connecting" → "paying"
# 3a. MetaMask popup: approve payment (0.005 STT)
# 3b. Wait for tx receipt
# Expected: ViewStep → "minting"

# F.4 AccessNFT minted, tokenId = 42
# Expected: ViewStep → "proving"
# 4a. Browser calls grant_view(viewer, 1, 42)
# 4b. Aleo Studio returns ViewToken proof
# Expected: ViewStep → "consuming"

# F.5 Route call: POST /api/verify-and-serve
# Expected: Route checks NFT, serves key, marks as consumed
# Expected: ViewStep → "verifying" → "playing"

# F.6 decryptAndPlay(videoId, hexKey) called
# Expected: Blob URL created, <video> loads
# Expected: Video plays, user watches

# F.7 After playback ends
# Expected: ViewStep → "completed" or return to "idle" if watching another video
```

#### Test Scenario 2: Edge Cases

**Insufficient Balance**
- User has <0.005 STT (VIDEO_PRICE_WEI)
- click "Watch Now"
- Expected: PopupBanner error "Insufficient balance to purchase access"
- Expected: ViewStep → "error"

**Wrong Network**
- User connected to Ethereum instead of Somnia
- click "Watch Now"
- Expected: PopupBanner error "Please switch to Somnia network"
- Expected: ViewStep → "error"

**Already Watched (NFT Already Consumed)**
- User already purchased and watched video 1
- User tries to purchase video 1 again with same wallet
- Expected: Route handler rejects (consumed flag set)
- Expected: PopupBanner error "You've already accessed this video"
- Expected: ViewStep → "error"

**Aleo Proof Fails**
- Browser can't connect to Aleo Studio
- click "Watch Now" (gets past payment)
- Expected: grant_view fails
- Expected: PopupBanner error "Could not generate Aleo proof — check your wallet"
- Expected: ViewStep → "error"

**Decryption Fails**
- Server decryption key is corrupted or wrong
- decryptAndPlay() called with bad key
- Expected: Web Crypto API throws
- Expected: PopupBanner error "Decryption failed — the key or asset may be corrupted. Contact support."
- Expected: ViewStep → "error"

### Phase G: Monitoring & Maintenance

#### Logs & Alerts

```bash
# G.1 Monitor route logs for errors (Vercel Functions or app host logs)

# G.2 Set up alerting for:
#     - Route 5xx errors
#     - Aleo proof generation failures
#     - NFT burn failures
#     - Zero decryption key lookups (bad videoId from frontend)
```

#### Contract Upgrades

```bash
# G.3 If bug found in PayPerView or AccessNFT:
#     - Fix contract
#     - Deploy new version
#     - Update NEXT_PUBLIC_*_ADDRESS in .env
#     - Redeploy frontend
#     - Keep old addresses in DEPRECATED list for historical reference
```

#### Aleo Program Updates

```bash
# G.4 If grant_view or consume_view logic changes:
#     - Update aleo/video_access.aleo
#     - Update src/lib/aleo-wallet.ts to match new transitions
#     - Deploy new program version to Aleo
#     - Update NEXT_PUBLIC_ALEO_PROGRAM_ID
#     - Redeploy frontend
```

## Summary Checklist

### Before Mainnet Launch

- [ ] **Contracts**
  - [ ] AccessNFT deployed and verified on block explorer
  - [ ] PayPerView deployed and verified on block explorer
  - [ ] setMinter() called successfully
  - [ ] Test mint via PayPerView.pay() (testnet)

- [ ] **Aleo**
  - [ ] video_access.aleo deployed to Aleo testnet/mainnet
  - [ ] NEXT_PUBLIC_ALEO_PROGRAM_ID set correctly
  - [ ] Test grant_view and consume_view transitions (testnet)

- [ ] **Encrypted Content**
  - [ ] All videos encrypted via scripts/encrypt-video.mjs
  - [ ] Encrypted files deployed to CDN with correct CORS
  - [ ] PPV_MASTER_KEY set in server environment

- [ ] **Server Routes**
  - [ ] Next.js route handlers running and verified
  - [ ] /api/verify-and-serve endpoint working
  - [ ] /api/video-meta/[id] endpoint returning correct metadata
  - [ ] Verify-and-serve burns NFTs after serving key

- [ ] **Frontend**
  - [ ] Build succeeds without errors
  - [ ] grep check: no YouTube URLs found
  - [ ] All NEXT_PUBLIC_* vars set
  - [ ] Wallet context working (Aleo + Somnia)
  - [ ] Watch page 4-step state machine working
  - [ ] Full end-to-end test passes (pay → mint → prove → decrypt → play)

- [ ] **Monitoring**
  - [ ] Logs configured on app route handlers
  - [ ] Error alerts set up
  - [ ] Block explorers and Aleo Studio accessible

### Launch Day

1. **Final Testnet Run**: Complete Phase F end-to-end test scenario
2. **Deploy App**: Vercel deploy --prod with all env vars set
3. **Smoke Test**: First 5 users complete full purchase + playback flow
4. **Monitor**: Watch logs for 24 hours, respond to any errors

---

**Deployment Complete!** 🚀

Your PPV platform is now live. Users can purchase fixed-price access, prove ownership via Aleo, and securely decrypt content via Next.js route handlers. All payments → NFTs → Aleo tokens → decryption keys → playback.

For questions or issues, refer to `.env.example` for configuration variables and review Phase 5–7 code in `src/lib/`, `scripts/`, and `src/app/api/` for implementation details.
