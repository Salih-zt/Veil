# VEIL — Decryption & Disclosure Flow

> **Document:** `DECRYPTION_FLOW.md`  
> **Repository:** `https://github.com/Salih-zt/Veil.git`  
> **Date:** 2026-11-06  

---

## 1. Overview

Decryption in VEIL is **information-theoretically impossible** from possession of the ciphertext alone. Key material is reconstructed only when an authorized recipient presents verified identity proofs, the embargo timelock has elapsed, and designated reviewers have confirmed approval onchain.

---

## 2. Decryption Sequence Diagram

```
Recipient               VEIL Web App             Smart Contract           Guardians (3 Nodes)
   │                         │                          │                          │
   │─── Paste Carrier ──────►│                          │                          │
   │                         │─── Decode Carrier ───────│                          │
   │                         │─── Query Policy ────────►│                          │
   │                         │◄── Return Policy State ──│                          │
   │                         │                          │                          │
   │─── Request Release ────►│                          │                          │
   │    (Sign EIP-191)       │─── Submit Request ──────►│                          │
   │    (World ID Proof)     │                          │                          │
   │    (ENS Verification)   │                          │                          │
   │                         │                          │                          │
   │                         │       [Reviewers vote approveRelease onchain]       │
   │                         │                          │                          │
   │─── Release Shares ─────►│                          │                          │
   │                         │─── Verify Onchain ─────────────────────────────────►│
   │                         │    & Deliver Request                                │
   │                         │                                                     │
   │                         │◄── Return Sealed Shares (X25519) ───────────────────│
   │                         │                                                     │
   │                         │─── Unseal Shares Locally                            │
   │                         │─── GF(256) Lagrange Interpolation                   │
   │                         │─── AES-256-SIV Decrypt                              │
   │◄── Display Plaintext ───│                                                     │
   │    & Disclosure Receipt │                                                     │
```

---

## 3. Step-by-Step Execution

1. **Carrier Ingestion**: Recipient pastes natural English carrier text into the Decoder (`/decrypt`) or opens a shareable link (`/decrypt?capsule=0x...#c=...`).
2. **Deterministic Reversal**: The 256-word bijection wordmap reverses the English prose byte-for-byte into the binary capsule descriptor.
3. **Onchain State Query**: The client inspects `VeilPolicyRegistry.sol`:
   - `unlockTimestamp` vs. blockchain time.
   - `approvalCount` vs. `threshold`.
   - `revoked` and `exists` flags.
4. **Early Access Demonstration (Fail-Closed)**: If conditions are unsatisfied, attempting release triggers a strict $423 \text{ Locked}$ cryptographic refusal from guardians.
5. **Decryption Request Submission**: Recipient generates an ephemeral X25519 keypair, signs an EIP-191 release authorization, and provides a fresh World ID proof and ENS attestation.
6. **Quorum Fulfillment**: Room approvers review the request and sign approval transactions onchain (`approveRelease`).
7. **Guardian Verification & Delivery**: Once conditions are met, at least $k$ of $n$ guardians verify contract state via RPC and deliver sealed key shares encrypted to the recipient's ephemeral public key.
8. **Client Reconstruction & Receipt**: The recipient unseals the shares, reconstructs the 256-bit DEK in transient browser memory, decrypts the ciphertext, and renders the verifiable **Disclosure Receipt**.
