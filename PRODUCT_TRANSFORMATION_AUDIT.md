# VEIL — Product Transformation Audit

> **Document:** `PRODUCT_TRANSFORMATION_AUDIT.md`  
> **Repository:** `https://github.com/Salih-zt/Veil.git`  
> **Target Version:** VEIL v2.0 Production MVP  
> **Date:** 2026-11-06  

---

## 1. Executive Summary

This audit evaluates the transition of VEIL from an initial research demonstration (with predefined personas: Alice, Bob, Charlie, David, Eve) into a **complete, wallet-native collaborative conditional encryption platform**.

The core cryptographic primitives (AES-256-SIV, Shamir Secret Sharing over $GF(256)$, X25519 gatebox sealing, 256-word reversible steganography) and smart contract policy foundation (`VeilPolicyRegistry.sol`) are mathematically sound and will be strictly preserved. The application layer, authentication system, member management, approval engine, and user interface are being transformed into a genuine multi-tenant, wallet-authenticated product.

---

## 2. Inventory of Existing Modules

| Module / Component | Path | Current State | Reusability / Transformation Strategy |
| :--- | :--- | :--- | :--- |
| **Capsule Encryption Engine** | `packages/crypto/capsule.mjs` | Functional | **Reuse 100%**: Deterministic AES-256-SIV AEAD with AAD policy binding. |
| **Shamir Secret Sharing** | `packages/crypto/sss.mjs` | Functional | **Reuse 100%**: $(k, n)$ secret sharing over Galois Field $GF(256)$. |
| **Key Sealing Envelopes** | `packages/crypto/gatebox.mjs` | Functional | **Reuse 100%**: Ephemeral X25519 ECDH + HKDF + AES-SIV sealed box. |
| **Stego Wordmap Codec** | `packages/crypto/codec/wordmap.mjs` | Functional | **Reuse 100%**: 256-word deterministic bijection. Reversible byte-for-byte. |
| **Policy Registry Contract** | `contracts/src/VeilPolicyRegistry.sol` | Functional | **Reuse & Connect**: Already supports arbitrary $M$-of-$N$ threshold and dynamic reviewer arrays. |
| **Guardian Microservices** | `packages/guardian/` | Functional | **Reuse**: Independent HTTP nodes with SQLite nullifier tracking on ports 8791, 8792, 8793. |
| **REST API Server** | `apps/api/server.mjs` | Prototype | **Transform**: Add full database persistence, room management, invitation tokens, real SIWE authentication, World ID verifier, and ENS resolver. |
| **Web Dashboard** | `apps/web/dashboard.html` | Prototype | **Transform**: Upgrade into full SPA with client-side routing (`/rooms`, `/rooms/create`, `/rooms/:id/capsules/create`, `/decrypt`, `/approvals`), real MetaMask integration, and dynamic multi-user state. |
| **Identity / Org Auth** | `packages/crypto/identity/` | Prototype | **Enhance**: Add official World ID 4.0 Cloud/IDKit verification API + explicitly labeled local demo adapter, and real bidirectional ENS verification. |

---

## 3. What Is Currently Mocked vs. What Must Be Built

### Currently Mocked / Predefined
1. **Predefined Personas**: Identities were hardcoded to Alice, Bob, Charlie, David, and Eve.  
   *Transformation*: Removed from production paths. Every user connects their real Ethereum wallet and authenticates via EIP-191 / SIWE signatures.
2. **Fixed 2-of-3 Reviewer Quorum**: Hardcoded in UI forms.  
   *Transformation*: Replaced with dynamic $M$-of-$N$ threshold selection ($1 \le M \le N$) with real-time quorum achievability tracking.
3. **Room-less Capsule Creation**: Capsules existed globally without collaborative scoping.  
   *Transformation*: Private collaborative rooms (`/rooms/create`, `/rooms/:id`) with role-based access control (Owner, Approver, Recipient, Observer).
4. **Invitation Flow**: Invitations were not formally tracked or validated.  
   *Transformation*: Cryptographically hashed single-use invitation tokens with expiration, email integration, and multi-step onboarding.
5. **ENS & World ID**: Simple simulated verification.  
   *Transformation*: Real bidirectional ENS validation (forward + reverse resolution matching) and official World ID Groth16 verification with strictly labeled demo fallback.

---

## 4. Database Schema Design (ACID SQLite)

We introduce a persistent relational store using Node.js built-in `node:sqlite`:

```sql
-- 1. Users & Profiles
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT UNIQUE,
  email_verified INTEGER DEFAULT 0,
  email_verified_at TEXT,
  wallet_address TEXT UNIQUE NOT NULL,
  ens_name TEXT,
  ens_verified INTEGER DEFAULT 0,
  ens_verified_at TEXT,
  world_id_verified INTEGER DEFAULT 0,
  world_id_nullifier TEXT UNIQUE,
  world_id_verified_at TEXT,
  created_at TEXT NOT NULL,
  status TEXT DEFAULT 'active'
);

-- 2. Email Verification & Magic Links
CREATE TABLE IF NOT EXISTS email_tokens (
  token_hash TEXT PRIMARY KEY,
  email TEXT NOT NULL,
  otp TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  used INTEGER DEFAULT 0
);

-- 3. Authenticated Sessions (SIWE)
CREATE TABLE IF NOT EXISTS auth_sessions (
  token TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- 4. Auth Nonces (EIP-191 Replay Defense)
CREATE TABLE IF NOT EXISTS auth_nonces (
  address TEXT PRIMARY KEY,
  nonce TEXT NOT NULL,
  message TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

-- 5. Collaborative Private Rooms
CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  organization TEXT,
  creator_wallet TEXT NOT NULL,
  visibility TEXT DEFAULT 'private',
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL
);

-- 6. Room Memberships & Roles
CREATE TABLE IF NOT EXISTS room_members (
  room_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  role TEXT NOT NULL, -- 'owner', 'approver', 'recipient', 'observer'
  joined_at TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  PRIMARY KEY (room_id, wallet_address)
);

-- 7. Room Invitations
CREATE TABLE IF NOT EXISTS room_invitations (
  id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  email TEXT,
  token_hash TEXT UNIQUE NOT NULL,
  role TEXT NOT NULL,
  inviter_wallet TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL
);

-- 8. Capsules & Policies
CREATE TABLE IF NOT EXISTS capsules (
  capsule_id TEXT PRIMARY KEY,
  room_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  classification TEXT DEFAULT 'CONFIDENTIAL',
  creator_wallet TEXT NOT NULL,
  access_mode TEXT DEFAULT 'named', -- 'named' | 'bearer'
  policy_hash TEXT NOT NULL,
  ciphertext_hash TEXT NOT NULL,
  storage_reference TEXT NOT NULL,
  carrier_text TEXT NOT NULL,
  unlock_timestamp INTEGER NOT NULL,
  expiry_timestamp INTEGER NOT NULL,
  approval_threshold INTEGER NOT NULL,
  guardian_threshold INTEGER NOT NULL,
  require_world_id INTEGER DEFAULT 1,
  require_ens INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  created_at TEXT NOT NULL
);

-- 9. Capsule Recipients (Named Mode)
CREATE TABLE IF NOT EXISTS capsule_recipients (
  capsule_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  PRIMARY KEY (capsule_id, wallet_address)
);

-- 10. Capsule Approvers (Dynamic M-of-N)
CREATE TABLE IF NOT EXISTS capsule_approvers (
  capsule_id TEXT NOT NULL,
  wallet_address TEXT NOT NULL,
  PRIMARY KEY (capsule_id, wallet_address)
);

-- 11. Decryption Release Requests
CREATE TABLE IF NOT EXISTS release_requests (
  request_id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  requester_wallet TEXT NOT NULL,
  requester_ens TEXT,
  requester_ephemeral_pubkey TEXT NOT NULL,
  nonce TEXT NOT NULL,
  signature TEXT NOT NULL,
  world_id_nullifier TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT NOT NULL
);

-- 12. Release Votes
CREATE TABLE IF NOT EXISTS release_votes (
  request_id TEXT NOT NULL,
  capsule_id TEXT NOT NULL,
  voter_wallet TEXT NOT NULL,
  vote TEXT NOT NULL, -- 'approve' | 'reject'
  signature TEXT,
  tx_hash TEXT,
  voted_at TEXT NOT NULL,
  PRIMARY KEY (request_id, voter_wallet)
);

-- 13. Verifiable Disclosure Receipts
CREATE TABLE IF NOT EXISTS disclosure_receipts (
  receipt_id TEXT PRIMARY KEY,
  capsule_id TEXT NOT NULL,
  recipient_wallet TEXT NOT NULL,
  released_at TEXT NOT NULL,
  details_json TEXT NOT NULL
);

-- 14. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_wallet TEXT NOT NULL,
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  link TEXT,
  read INTEGER DEFAULT 0,
  created_at TEXT NOT NULL
);
```

---

## 5. Security Boundaries & Invariants Preserved

1. **Zero Server Plaintext**: Secrets and DEKs are encrypted client-side in the browser using AES-256-SIV AEAD. Plaintext never reaches API logs or disk.
2. **Zero Raw Share Leakage**: Shamir shares remain sealed with ephemeral X25519 boxes targeted to specific guardian public keys.
3. **Onchain State as Source of Truth**: Smart contract `VeilPolicyRegistry.sol` immutably binds unlock timestamps, reviewer quorum thresholds, and approval transactions.
4. **Strict Fail-Closed Guardians**: Guardian nodes refuse share release unless all cryptographic, identity, and smart contract criteria are satisfied.
5. **Anti-Replay Nullifiers**: Every release request contains an ephemeral recipient keypair and a single-use nonce tracked in SQLite.

---

## 6. Implementation Action Plan

1. **Backend Database & Storage**: Implement `apps/api/db.mjs` using `node:sqlite`.
2. **Identity Modules**: Implement `packages/crypto/identity/world-id-v2.mjs` and `packages/crypto/identity/ens-resolver.mjs`.
3. **Room & Invitation Services**: Implement room creation, invite token generation, and membership validation.
4. **Dynamic M-of-N Approval Engine**: Compute quorum, track votes, and execute onchain approvals.
5. **API Endpoints**: Wire up `/api/v1/rooms`, `/api/v1/invitations`, `/api/v1/users`, `/api/v1/decrypt`, etc.
6. **Full Web Application**: Deliver production-grade UI with client-side routing, Web3 wallet integration, and room dashboards.
7. **Testing & Documentation**: Verify complete 34-step acceptance test and author all 12 markdown reports.
