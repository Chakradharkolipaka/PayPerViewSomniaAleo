# Somnia Pay-Per-View – Detailed Documentation

A privacy-preserving pay-per-view DApp built on Somnia EVM (payments + NFT) and Aleo (privacy proofs).  
Users pay **0.005 STT** once per view → receive a non-transferable AccessNFT → generate an Aleo proof → backend burns the NFT and returns the AES decryption key → video plays.

---

## Table of Contents

1. [Architecture Overview](#1-architecture-overview)
2. [Deployment Steps (Vercel)](#2-deployment-steps-vercel)
3. [Running Locally](#3-running-locally)
4. [Provisioning Storage](#4-provisioning-storage)
5. [Running Tests](#5-running-tests)
6. [Environment Variables Reference](#6-environment-variables-reference)
7. [API Route Reference](#7-api-route-reference)
8. [Security & Secret Rotation](#8-security--secret-rotation)
9. [Audit Checklist](#9-audit-checklist)

---

## 1. Architecture Overview

```
Viewer Browser
  │
  ├─ 1. Connect Somnia wallet (MetaMask / RainbowKit)
  ├─ 2. Connect Aleo wallet (Leo Wallet)
  ├─ 3. Call PayPerView.pay(videoId) — 0.005 STT
  │        → AccessNFT.mintAccess(viewer, videoId) → tokenId
  ├─ 4. Call Aleo grant_view(viewer, videoId, tokenId) → ViewToken record
  ├─ 5. POST /api/watch-gate/{videoId}
  │        → verifyAndServeAccess({ tokenId, viewerAddress })
  │            → ownerOf(tokenId) == viewerAddress   ← Somnia RPC
  │            → consumed(tokenId) == false           ← Somnia RPC
  │            → consumeAccess(tokenId)               ← backend wallet burns NFT
  │            → derive decryptionKey via HMAC-SHA256(PPV_MASTER_KEY, "ppv:{videoId}")
  │        ← returns { decryptionKey }
  └─ 6. AES-256-CBC decrypt(encryptedAsset, decryptionKey) → play video
```

**Contracts (Somnia EVM)**
| Contract | Role |
|---|---|
| `PayPerView.sol` | Accepts 0.005 STT, emits events, calls mintAccess |
| `AccessNFT.sol` | Non-transferable ERC-721; burns on consumption |

**Aleo program (`video_access.aleo`)**  
Only used for privacy proofs. The `grant_view` / `consume_view` transitions produce ViewToken records that prove the holder paid without revealing the video ID on-chain.

**Storage**
| Priority | Condition | Storage |
|---|---|---|
| 1 | `AWS_S3_BUCKET` set | Amazon S3 (`video-storage` bucket) |
| 2 | `BLOB_READ_WRITE_TOKEN` set | Vercel Blob |
| 3 | Neither set | Local `public/encrypted/` (dev only) |

---

## 2. Deployment Steps (Vercel)

### 2.1 Deploy Smart Contracts

```bash
# 1. Copy environment template
cp .env.example .env.local
# Fill in PRIVATE_KEY, SOMNIA_RPC_URL

# 2. Compile contracts
npm run contracts:compile

# 3. Deploy to Somnia Testnet
npm run contracts:deploy:somnia
# Note the printed AccessNFT and PayPerView addresses.

# 4. Set the minter (one-time setup)
node scripts/smoke-test.mjs  # verifies the deployment
```

### 2.2 Configure Vercel Environment Variables

In the Vercel project settings → **Environment Variables**, add:

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SOMNIA_RPC_URL` | Somnia RPC endpoint |
| `NEXT_PUBLIC_ACCESS_NFT_ADDRESS` | Deployed AccessNFT address |
| `NEXT_PUBLIC_PAYPERVIEW_ADDRESS` | Deployed PayPerView address |
| `NEXT_PUBLIC_ALEO_PROGRAM_ID` | Deployed Aleo program ID |
| `SOMNIA_RPC_URL` | Server-side RPC (same or different) |
| `ACCESS_NFT_ADDRESS` | Server-side AccessNFT address |
| `BACKEND_PRIVATE_KEY` | Private key of the backend wallet that burns NFTs |
| `PPV_MASTER_KEY` | Long random secret for AES key derivation |
| `STT_TOKEN_ADDRESS` | Somnia STT token address |
| `STT_RPC_URL` | STT token RPC URL |
| `AWS_S3_BUCKET` | S3 bucket name (`video-storage`) |
| `AWS_ACCESS_KEY_ID` | AWS access key |
| `AWS_SECRET_ACCESS_KEY` | AWS secret key |
| `AWS_REGION` | AWS region (default: `us-east-1`) |
| `ALEO_SEED_PHRASE` | Aleo wallet seed phrase (server-side proof signing) |

### 2.3 Deploy to Vercel

```bash
# Option A: Vercel CLI
npm i -g vercel
vercel --prod

# Option B: GitHub integration
# Push to main → Vercel auto-deploys.
```

---

## 3. Running Locally

### Prerequisites

- Node.js ≥ 20
- npm ≥ 10

```bash
# 1. Clone
git clone https://github.com/<org>/PayPerViewSomniaAleo.git
cd PayPerViewSomniaAleo

# 2. Install dependencies
npm install

# 3. Create local env file
cp .env.example .env.local
# Edit .env.local: set at least PPV_MASTER_KEY and SOMNIA_RPC_URL

# 4. Start the dev server
npm run dev
# → http://localhost:3000
```

**Local dev storage**  
Without S3 or Vercel Blob credentials, encrypted videos are saved to `public/encrypted/` and the video catalog is persisted in `storage/videos.json`.

---

## 4. Provisioning Storage

### 4.1 Amazon S3

```bash
# Create the bucket
aws s3 mb s3://video-storage --region us-east-1

# Apply a bucket policy to block public GetObject
# (objects are only accessed via signed URLs or direct server access)
aws s3api put-bucket-acl --bucket video-storage --acl private

# Create an IAM user with PutObject + GetObject on this bucket
# Copy the Access Key ID and Secret Access Key to .env.local
```

Set in `.env.local`:
```
AWS_S3_BUCKET=video-storage
AWS_ACCESS_KEY_ID=<your-key-id>
AWS_SECRET_ACCESS_KEY=<your-secret>
AWS_REGION=us-east-1
```

### 4.2 Vercel Blob (Alternative)

```bash
# In Vercel dashboard: Storage → Create Blob Store
# Copy the BLOB_READ_WRITE_TOKEN to .env.local
```

Set in `.env.local`:
```
BLOB_READ_WRITE_TOKEN=vercel_blob_rw_...
```

### 4.3 Video Catalog

Video metadata (title, description, creator, price, encryptedAssetUrl) is stored as a JSON array:
- **S3 / Blob**: Written to `ppv/catalog/videos.json` in the blob/bucket.
- **Local dev**: Written to `storage/videos.json`.

---

## 5. Running Tests

### Contract Tests (Hardhat)

```bash
# Compile contracts (requires internet access to download solc)
npm run contracts:compile

# Run all contract tests
npm run contracts:test

# Run unit tests only
npm run contracts:test:unit

# Run integration tests only
npm run contracts:test:integration

# Run without recompiling (uses cached artifacts)
npx hardhat test test/unit/*.test.js --no-compile
npx hardhat test test/integration/*.test.js --no-compile
```

### API Route Tests

```bash
# Node.js-based API smoke tests (no browser required)
node test/api.spec.js
```

The API spec file checks:
- `GET /api/videos` → `{ videos: [] }` when catalog is empty
- `GET /api/health` → `{ status: "ok" }`
- `POST /api/proof-verify` with valid record → `{ valid: true }`
- `POST /api/proof-verify` without record → 400
- `POST /api/mint` without required fields → 400
- `POST /api/watch-gate/:videoId` without body → 400

---

## 6. Environment Variables Reference

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SOMNIA_RPC_URL` | ✓ | Public RPC for frontend |
| `NEXT_PUBLIC_ACCESS_NFT_ADDRESS` | ✓ | AccessNFT contract address |
| `NEXT_PUBLIC_PAYPERVIEW_ADDRESS` | ✓ | PayPerView contract address |
| `NEXT_PUBLIC_ALEO_PROGRAM_ID` | ✓ | Deployed Aleo program |
| `SOMNIA_RPC_URL` | ✓ | Server-side RPC |
| `ACCESS_NFT_ADDRESS` | ✓ | Server-side contract address |
| `BACKEND_PRIVATE_KEY` | ✓ | Private key that calls `consumeAccess` |
| `PPV_MASTER_KEY` | ✓ | HMAC key for video AES derivation |
| `STT_TOKEN_ADDRESS` | ✓ | Somnia STT token address |
| `STT_RPC_URL` | ✓ | Somnia RPC for token balance checks |
| `AWS_S3_BUCKET` | S3 only | S3 bucket name |
| `AWS_ACCESS_KEY_ID` | S3 only | AWS access key ID |
| `AWS_SECRET_ACCESS_KEY` | S3 only | AWS secret access key |
| `AWS_REGION` | S3 only | AWS region (default: `us-east-1`) |
| `BLOB_READ_WRITE_TOKEN` | Blob only | Vercel Blob token |
| `ALEO_SEED_PHRASE` | optional | Aleo wallet seed for server-side signing |
| `NEXT_PUBLIC_DEBUG` | optional | Set `"true"` to show DebugPanel |
| `LOG_LEVEL` | optional | Set `"debug"` for verbose server logs |

---

## 7. API Route Reference

### `GET /api/videos`
Returns the sorted video catalog.
```json
{ "videos": [{ "id": 1, "title": "...", "description": "...", "creator": "0x...", "priceSTT": "0.005", "createdAt": "...", "encryptedAssetUrl": "..." }] }
```

### `POST /api/mint`
Upload and encrypt an MP4 video.  
**Body**: `multipart/form-data` — `title`, `description`, `creator`, `file` (.mp4, max 100 MB)  
**Response**: `{ ok: true, videoId: number, encryptedAssetUrl: string }`

### `POST /api/watch-gate/:videoId`
Verify NFT ownership, burn token, return decryption key.  
**Body**: `{ tokenId: string, viewerAddress: string, consumedAleoRecord?: string }`  
**Response**: `{ status: "consumed", decryptionKey: string, videoId: string }`

### `GET /api/health`
Readiness check.
```json
{ "status": "ok", "checks": { "somniaRpc": true, "accessNftAddress": true, "backendKey": true, "ppvMasterKey": true } }
```

### `POST /api/proof-verify`
Validate an Aleo ViewToken record.  
**Body**: `{ record: string, programId?: string }`  
**Response**: `{ valid: boolean, message: string }`

### `GET /api/video-meta/:id`
Get metadata for a single video by ID.  
**Response**: `{ videoId, title, description, creator, priceSTT, encryptedAssetUrl }`

### `POST /api/verify-and-serve`
Legacy alias for watch-gate (no videoId path param).  
Prefer `/api/watch-gate/:videoId` for new integrations.

---

## 8. Security & Secret Rotation

### PPV_MASTER_KEY rotation

1. Generate a new key: `openssl rand -hex 32`
2. Re-encrypt all existing videos using the new key (re-run the upload flow)
3. Update `PPV_MASTER_KEY` in your deployment environment
4. Redeploy

### BACKEND_PRIVATE_KEY rotation

1. Generate a new Ethereum private key
2. Fund the new address with STT for gas
3. Update `BACKEND_PRIVATE_KEY` in your deployment environment
4. Redeploy

### AWS credential rotation

1. Create new AWS IAM access keys in the console
2. Update `AWS_ACCESS_KEY_ID` and `AWS_SECRET_ACCESS_KEY`
3. Redeploy
4. Delete the old access keys from IAM

### ALEO_SEED_PHRASE

- Store only in secure secret managers (AWS Secrets Manager, Vercel secrets)
- Rotate by generating a new Aleo account and updating the environment variable

---

## 9. Audit Checklist

- [ ] No YouTube URLs in codebase (`grep -r "youtube" . --include="*.ts" --include="*.tsx"`)
- [ ] No IPFS imports (`grep -r "ipfs" . --include="*.ts" --include="*.tsx"`)
- [ ] No X-408 token-transfer code
- [ ] `PPV_MASTER_KEY` is at least 32 random bytes
- [ ] `BACKEND_PRIVATE_KEY` is NOT the same as the contract deployer key
- [ ] S3 bucket is private (no public `GetObject`)
- [ ] AccessNFT `setMinter` called exactly once (PayPerView address)
- [ ] `pay()` reverts with `IncorrectPayment` for wrong value (verified by unit tests); `WrongPayment` is also declared in the ABI per spec
- [ ] AccessNFT transfers revert with `NonTransferable` (verified by unit tests)
- [ ] Full flow test: pay → mint → consume → decrypt passes end-to-end
- [ ] All environment variables documented in `.env.example`
- [ ] Contracts verified on Somnia block explorer
- [ ] Aleo program ID pinned in `NEXT_PUBLIC_ALEO_PROGRAM_ID`
