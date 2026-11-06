# VEIL — Product Implementation Report

> **Document:** `PRODUCT_IMPLEMENTATION_REPORT.md`  
> **Repository:** `https://github.com/Salih-zt/Veil.git`  
> **Target Version:** VEIL v2.0 Production MVP  
> **Date:** 2026-11-06  

---

## 1. Executive Summary

VEIL has transitioned from an initial research prototype into a **collaborative conditional encryption platform**. The platform replaces hardcoded demo identities with real EIP-191 Sign-In with Ethereum (SIWE) authentication, bidirectional ENS identity verification, World ID 4.0 proof-of-humanity verification, private collaborative rooms, and a flexible $M$-of-$N$ threshold governance engine.

---

## 2. Completed Architecture Overview

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                VEIL v2.0 SYSTEM TOPOLOGY                               │
├──────────────────────────┬───────────────────────────────┬─────────────────────────────┤
│ CLIENT LAYER             │ PROTOCOL / API LAYER          │ DECENTRALIZED INFRASTRUCTURE│
│                          │                               │                             │
│ • Web3 Wallet (MetaMask) │ • SIWE Session Manager        │ • VeilPolicyRegistry.sol    │
│ • Client-Side AES-256-SIV│ • Relational Store (SQLite)   │   (Arbitrary M-of-N Quorum) │
│ • SSS (k, n) over GF(256)│ • World ID 4.0 Verifier       │ • 3-Node Independent Cluster│
│ • Reversible 256-Word    │ • Bidirectional ENS Engine    │   (:8791, :8792, :8793)     │
│   Steganographic Codec   │ • Rooms & Single-Use Invites  │ • Ephemeral X25519 Sealed   │
│ • Ephemeral Box Unsealer │ • Dynamic Quorum Calculator   │   Envelopes at rest         │
└──────────────────────────┴───────────────────────────────┴─────────────────────────────┘
```

---

## 3. Detailed Component Implementation

### 3.1 Authentication & User Management
- **Cryptographic Challenge-Response (SIWE)**: Implements EIP-191 message signing. Nonces are cryptographically random 128-bit values stored with 300s TTL in SQLite. Replay attempts are rejected.
- **Email Registration & OTP Binding**: Users can link a corporate or personal email to their cryptographic wallet identity via a 6-digit OTP. Email addresses remain offchain and are never written to the blockchain.
- **User Profiles**: Persistent records in `users` table tracking User ID, verified email, wallet address, verified ENS name, World ID nullifier, and creation timestamp.

### 3.2 Private Collaborative Rooms & Invitations
- **Room Lifecycle**: Users create private rooms (`/rooms/create`) specifying name, description, organization, and visibility.
- **Role-Based Permissions**: Four distinct room roles:
  1. `owner`: Manages room settings, invites members, authors capsules.
  2. `approver`: Eligible for selection in dynamic $M$-of-$N$ capsule release quorums.
  3. `recipient`: Permitted to submit decryption requests for named capsules.
  4. `observer`: Read-only metadata visibility.
- **Single-Use Expiring Invitations**: Generated with unique 192-bit raw tokens hashed using SHA-256 before database storage. When accepted, the token is permanently invalidated.

### 3.3 Dynamic M-of-N Approval Policies
- **Arbitrary Quorum**: Replaced hardcoded 2-of-3 logic with dynamic $M$-of-$N$ configuration ($1 \le M \le N$). Supports any threshold (e.g., 1-of-3, 2-of-3, 3-of-3, 4-of-5, 5-of-5).
- **Onchain Commitment**: Recorded in `VeilPolicyRegistry.sol` via `createCapsule(..., uint8 threshold, address[] reviewers)`.
- **Quorum Mathematics**: Tracks votes in real time:
  - Required approvals ($M$).
  - Approvals received ($A$).
  - Rejections received ($R$).
  - Quorum achieved: $A \ge M$.
  - Impossible quorum: $(N - R) < M$.

### 3.4 Cryptographic Pipeline & Reversible Carrier Text
1. **Client Plaintext Protection**: Confidential messages never leave the user's browser in plaintext.
2. **AES-256-SIV AEAD**: Encrypted with 512-bit master key (`K_mac || K_enc`), binding onchain policy hash as Additional Authenticated Data (AAD).
3. **Threshold Key Splitting**: DEK is split into $(k, n)$ Shamir shares over Galois Field $GF(256)$ with irreducible polynomial $0x11b$.
4. **Key Share Sealing**: Shares are sealed using ephemeral X25519 authenticated Diffie-Hellman boxes targeted to independent guardian public keys.
5. **Reversible Steganographic Encoding**: Binary capsule descriptor is transformed into natural English prose via a 256-word bijection wordmap.
6. **Recipient Reconstruction**: The authorized recipient collects threshold shares, unseals them with their ephemeral private key, interpolates the 256-bit DEK in transient memory, and AES-256-SIV decrypts the secret.

---

## 4. Database Schema Summary

| Table | Purpose |
| :--- | :--- |
| `users` | Primary user profile, wallet address, email, ENS, World ID verification. |
| `auth_sessions` | Active SIWE session tokens with TTL. |
| `auth_nonces` | Ephemeral EIP-191 challenge nonces (replay prevention). |
| `email_tokens` | Single-use email verification OTP tokens. |
| `rooms` | Private collaborative rooms and metadata. |
| `room_members` | Room participants, roles (`owner`, `approver`, `recipient`, `observer`). |
| `room_invitations` | SHA-256 hashed single-use invitation tokens with expiration. |
| `capsules` | Capsule records, onchain policy hash, storage reference, carrier text. |
| `capsule_recipients` | Whitelisted named recipient wallet addresses. |
| `capsule_approvers` | Whitelisted eligible reviewer wallet addresses for $M$-of-$N$ quorum. |
| `release_requests` | Decryption requests with recipient nonce and ephemeral public key. |
| `release_votes` | Reviewer approval/rejection votes and onchain transaction hashes. |
| `disclosure_receipts` | Verifiable cryptographic disclosure receipts. |
| `notifications` | In-app alerts for pending approvals and unlocks. |
