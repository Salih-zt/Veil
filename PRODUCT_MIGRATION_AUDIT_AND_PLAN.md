# VEIL — Architectural Migration Audit & Implementation Plan

## Executive Summary

This document establishes the audit and engineering migration roadmap to transform **VEIL** into a unified, production-grade web application built with **Next.js (App Router), React, TypeScript, and Tailwind CSS**. 

The existing implementation across cryptographic primitives, smart contracts, independent guardian clusters, identity verifiers (World ID 4.0, ENS), SDK adapters, and relational persistence will be unified into one cohesive full-stack web application.

---

## 1. Comprehensive Repository Audit

### 1.1 Cryptographic Core (`packages/crypto`)
* **Location**: `packages/crypto/capsule.mjs`, `sss.mjs`, `keys.mjs`, `sealed.mjs`, `codec/stego.mjs`.
* **Current Mechanism**:
  - `capsule.mjs`: Implements AES-256-SIV deterministic AEAD via `@noble/ciphers/aes.js`. Binds the onchain `policyHash` into Associated Authenticated Data (AAD).
  - `sss.mjs`: Shamir's Secret Sharing over $GF(256)$ with Lagrange polynomial interpolation. Splits the 256-bit Data Encryption Key (DEK) into $N$ shares with threshold $M$.
  - `keys.mjs` & `sealed.mjs`: Implements X25519 ephemeral-static Diffie-Hellman sealed boxes to encrypt key shares specifically for guardian public keys.
  - `codec/stego.mjs`: Reversible 256-word natural English dictionary steganographic codec. Converts binary capsule descriptors to 64-word English paragraphs.
* **Dependencies**: `@noble/ciphers`, `@noble/curves`, `@noble/hashes`, `@scure/bip39`.
* **Current Access**: Accessed directly in test runners and via script wrappers; copied into frontend helper routines.
* **Integrity Status**: **Complete, verified (81/81 tests passing).**
* **Next.js Integration Strategy**:
  - Encapsulate in `src/lib/crypto/` for direct **client-side execution** inside browser bundles.
  - **Critical Security Invariant**: Plaintext, raw DEKs, and unsealed Shamir shares will *never* be sent to or processed by Next.js server actions or route handlers. All encryption, splitting, unsealing, and reconstruction execute client-side in memory.

---

### 1.2 Smart Contracts (`contracts/`)
* **Location**: `contracts/src/VeilPolicyRegistry.sol`, `contracts/script/DeployVeilPolicyRegistry.s.sol`.
* **Current Mechanism**:
  - Implements `createCapsule(bytes32 capsuleId, bytes32 policyHash, uint64 releaseTimestamp, uint64 expiryTimestamp, uint16 requiredApprovals, address[] calldata reviewers)`.
  - Enforces duplicate prevention, quorum tracking, and timelock checks via `isReleaseReady()`.
* **Dependencies**: Foundry (`forge`, `anvil`), Solidity 0.8.28.
* **Current Access**: Interacted via `viem` public and wallet clients.
* **Integrity Status**: **Complete, verified (20/20 Foundry tests passing).**
* **Next.js Integration Strategy**:
  - Integrate contract ABIs and Viem configurations in `src/lib/blockchain/client.ts`.
  - Frontend triggers client-side MetaMask / Web3 wallet transactions for capsule registration and reviewer approvals.
  - Next.js server-side read functions verify onchain state before coordinating guardian releases.

---

### 1.3 Guardian Cluster (`packages/guardian`)
* **Location**: `packages/guardian/guardian.mjs`, `cluster.mjs`, `client.mjs`.
* **Current Mechanism**:
  - 3 independent guardian processes (Alpha on 8791, Beta on 8792, Gamma on 8793) maintaining local encrypted SQLite databases.
  - Enforces policy validation by reading onchain state or signed authorizations.
  - Returns secp256k1 signed release tokens enclosing encrypted key shares.
* **Dependencies**: `node:sqlite`, `@noble/curves/secp256k1`, `viem`.
* **Current Access**: HTTP REST requests from SDK and API server.
* **Integrity Status**: **Complete, verified (4/4 cluster tests passing).**
* **Next.js Integration Strategy**:
  - Retain guardians as independent long-running background processes (as architectural isolation mandates; guardians must not run as serverless route handlers).
  - Integrate typed guardian adapters in `src/lib/guardians/client.ts` to orchestrate health queries and share delivery from Next.js server endpoints and client decoder.

---

### 1.4 Identity & Attestations (`packages/crypto/identity/`)
* **Location**: `packages/crypto/identity/world-id-v2.mjs`, `ens-resolver.mjs`.
* **Current Mechanism**:
  - `world-id-v2.mjs`: World ID 4.0 verification with Semaphore BN254 Groth16 proof validation and signal hash binding (`keccak256(recipientAddress) >> 8n`).
  - `ens-resolver.mjs`: Bidirectional ENS verification ensuring forward resolution equals reverse resolution (`forward(name) === address` and `reverse(address) === name`).
* **Dependencies**: `@noble/hashes`, `viem`.
* **Current Access**: Invoked by API endpoints `/api/identity/ens/verify` and `/api/identity/world-id/verify`.
* **Integrity Status**: **Complete, verified.**
* **Next.js Integration Strategy**:
  - Integrate into `src/lib/identity/` and route handlers `src/app/api/identity/`.
  - Client components provide interactive World ID proof generation and ENS lookup with visual badge states.

---

### 1.5 Database & Relational Persistence (`apps/api/db.mjs`)
* **Location**: `apps/api/db.mjs`.
* **Current Mechanism**:
  - Built-in `node:sqlite` WAL database managing 14 relational tables: `users`, `email_tokens`, `auth_sessions`, `auth_nonces`, `rooms`, `room_members`, `room_invitations`, `capsules`, `capsule_recipients`, `capsule_approvers`, `release_requests`, `release_votes`, `disclosure_receipts`, `notifications`.
* **Dependencies**: `node:sqlite`, `@noble/hashes`.
* **Integrity Status**: **Complete, ACID compliant.**
* **Next.js Integration Strategy**:
  - Integrate singleton database adapter in `src/lib/database/db.ts` utilizing `node:sqlite`.
  - Provide typed database operations for users, rooms, invitations, capsules, and receipts.

---

### 1.6 Authentication & Sessions (`apps/api/server.mjs`)
* **Location**: `apps/api/server.mjs`.
* **Current Mechanism**:
  - SIWE (EIP-191) cryptographic challenge/response using single-use nonces with 5-minute expiry.
  - Email registration with single-use 6-digit OTP tokens with 10-minute expiry.
  - Bearer session token authentication.
* **Integrity Status**: **Complete, verified.**
* **Next.js Integration Strategy**:
  - Port into `src/app/api/auth/[...route]/route.ts` or distinct Next.js Route Handlers (`/api/auth/nonce`, `/api/auth/verify`, `/api/auth/me`, `/api/auth/email/send-otp`, `/api/auth/email/verify-otp`).
  - Secure session storage via HTTP-only cookie or client auth provider context.

---

## 2. Target Unified Architecture

```text
veil/
├── src/
│   ├── app/
│   │   ├── (marketing)/                 # Public marketing routes
│   │   │   ├── page.tsx                 # High-impact landing page
│   │   │   ├── protocol/page.tsx        # Technical protocol specifications
│   │   │   ├── how-it-works/page.tsx    # 5-step interactive workflow
│   │   │   └── use-cases/page.tsx       # Enterprise & security disclosure use cases
│   │   │
│   │   ├── (auth)/
│   │   │   └── login/page.tsx           # Real Web3 SIWE & Email OTP login
│   │   │
│   │   ├── (workspace)/app/             # Authenticated workspace
│   │   │   ├── layout.tsx               # Enterprise sidebar & topbar layout
│   │   │   ├── page.tsx                 # Workspace overview & vault stats
│   │   │   ├── rooms/                   # Private collaborative rooms
│   │   │   │   ├── page.tsx
│   │   │   │   ├── create/page.tsx
│   │   │   │   └── [roomId]/page.tsx
│   │   │   ├── capsules/                # Capsule creation & management
│   │   │   │   ├── page.tsx
│   │   │   │   ├── create/page.tsx
│   │   │   │   └── [capsuleId]/page.tsx
│   │   │   ├── approvals/page.tsx       # Reviewer approval dashboard
│   │   │   ├── received/page.tsx        # Received capsules inbox
│   │   │   ├── decoder/page.tsx         # Carrier stego decoder & local decryption
│   │   │   ├── guardians/page.tsx       # Guardian cluster health & telemetry
│   │   │   ├── identity/page.tsx        # World ID & ENS verification center
│   │   │   ├── history/page.tsx         # Verifiable disclosure receipts
│   │   │   ├── developers/page.tsx      # Real SDK documentation & code snippets
│   │   │   └── settings/page.tsx       # Account & notification preferences
│   │   │
│   │   ├── api/                         # Next.js Route Handlers
│   │   │   ├── auth/                    # SIWE nonce, verify, me, OTP
│   │   │   ├── rooms/                   # Rooms CRUD & invitations
│   │   │   ├── capsules/                # Capsules registration & decoding
│   │   │   ├── approvals/               # Reviewer votes
│   │   │   ├── guardians/               # Guardian cluster proxies
│   │   │   ├── identity/                # World ID & ENS endpoints
│   │   │   └── receipts/                # Disclosure receipt retrieval
│   │   │
│   │   ├── layout.tsx                   # Root HTML & metadata
│   │   ├── globals.css                  # Tailwind CSS v4 & design tokens
│   │   └── providers.tsx                # Web3 & Auth React context providers
│   │
│   ├── components/                      # Reusable UI component library
│   │   ├── ui/                          # HyperUI / Tailwind atomic primitives
│   │   ├── layout/                      # Navbar, Sidebar, Header, Footer
│   │   ├── marketing/                   # Interactive protocol diagrams
│   │   ├── capsules/                    # Multi-step creation & policy builder
│   │   ├── decoder/                     # Local decryption & key reconstruction
│   │   └── guardians/                   # Node telemetry cards
│   │
│   ├── lib/                             # Core server & client logic
│   │   ├── auth/                        # SIWE & token verification
│   │   ├── blockchain/                  # Viem client & contract ABIs
│   │   ├── crypto/                      # Client-side AES-256-SIV, SSS, Stego
│   │   ├── database/                    # SQLite relational store (ACID)
│   │   ├── guardians/                   # Cluster client
│   │   └── identity/                    # World ID & ENS resolvers
│   │
│   ├── hooks/                           # Custom React hooks (wallet, auth, capsule)
│   └── types/                           # Shared TypeScript interfaces
```

---

## 3. Strict Security Boundaries

1. **Client-Side Key Management**:
   - The Data Encryption Key (DEK) is generated using `crypto.getRandomValues(32)`.
   - Encryption uses AES-256-SIV AEAD entirely in the browser.
   - The DEK is split into $N$ Shamir shares over $GF(256)$ in the browser.
   - Shares are sealed inside ephemeral X25519 boxes for guardians.
   - **The Next.js backend NEVER receives plaintexts, raw DEKs, or unsealed Shamir shares.**
2. **Fail-Closed Policy Enforcement**:
   - Guardians refuse to release shares if the timelock has not elapsed or reviewer quorum has not been satisfied onchain.
   - The decoder reconstructs the DEK and decrypts the payload *locally* inside client memory.

---

## 4. Design System Tokens (VEIL Theme)

* **Background Dark Olive**: `#171A10`
* **Sidebar Deep Olive**: `#1D2115`
* **Surface / Card**: `#252A1B`
* **Elevated Surface**: `#303624`
* **Input Background**: `#12150D`
* **Primary Olive**: `#858C50`
* **Light Sage**: `#B2B77A`
* **Muted Gold**: `#C6B95F`
* **Warm Yellow**: `#E6D98D`
* **Primary Text**: `#F3F0E4`
* **Secondary Text**: `#A9A58D`
* **Border Subtle**: `#2D3321`
* **Border Strong**: `#3A402C`
* **Font Sans**: Inter / Geist / system-ui
* **Font Mono**: JetBrains Mono / SF Mono / monospace

---

## 5. Phased Implementation Roadmap

* **Phase A**: Complete Audit & Architecture Plan *(Completed)*.
* **Phase B**: Next.js App Router, TypeScript, and Tailwind CSS v4 foundation.
* **Phase C**: VEIL Design System components (HyperUI-adapted buttons, inputs, cards, tables, badges, sidebars, headers).
* **Phase D**: Public marketing pages (`/`, `/protocol`, `/how-it-works`, `/use-cases`).
* **Phase E**: Real Web3 wallet SIWE authentication & session provider.
* **Phase F**: Authenticated workspace migration:
  - Rooms & invitation management
  - Capsule creation with client-side encryption & carrier generation
  - Received capsules & carrier decoder with local decryption
  - Reviewer approval dashboard
  - Guardian network monitor
  - Identity center (World ID + ENS)
  - Disclosure receipts & history
  - Developer SDK reference
* **Phase G**: Next.js Route Handlers integrating existing SQLite database, blockchain client, and guardian cluster.
* **Phase H**: End-to-end testing, production build verification, and final deliverables report.
