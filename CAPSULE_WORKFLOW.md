# VEIL — Capsule Workflow Specification

> **Document:** `CAPSULE_WORKFLOW.md`  
> **Repository:** `https://github.com/Salih-zt/Veil.git`  
> **Date:** 2026-11-06  

---

## 1. Overview

A VEIL **Capsule** is an autonomous cryptographic disclosure container. It binds a confidential secret to an immutable, verifiable release policy without ever exposing plaintext or encryption keys to servers, databases, or blockchain transactions.

---

## 2. Multi-Step Creation Workflow

```
┌────────────────────────────────────────────────────────────────────────┐
│                        CAPSULE CREATION WORKFLOW                       │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ 1. CLIENT ENCRYPT  │ 2. SSS KEY SPLIT   │ 3. REGISTRY & STEGO          │
│                    │                    │                              │
│ 256-bit fresh DEK  │ (k, n) Shamir over │ Policy registered onchain    │
│ AES-256-SIV AEAD   │ Galois Field GF(256│ Sealed shares deposited      │
│ AAD policy binding │ Sealed to guardians│ 256-word carrier text built  │
└────────────────────┴────────────────────┴──────────────────────────────┘
```

### Step 1: Secret Message Input
- Author enters secret plaintext (advisory, credentials, patch commit).
- Handled strictly in browser memory. Never sent across network in cleartext.

### Step 2: Access Mode Selection
- **Mode A (Bearer Access)**: Decryptable by any verified individual who satisfies the timelock, quorum, World ID, and ENS requirements.
- **Mode B (Named Recipient)**: Decryptable solely by specifically whitelisted wallet address(es) (Default).

### Step 3: Approval Configuration
- Dynamic $M$-of-$N$ threshold selection ($1 \le M \le N$).
- Whitelist of eligible reviewer addresses.
- Optional inclusion of creator wallet in approver set.

### Step 4: Time Conditions
- Earliest unlock timestamp (embargo deadline).
- Expiration timestamp (after which capsule cannot be unlocked).

### Step 5: Identity Conditions
- Require World ID 4.0 Proof-of-Humanity.
- Require verified primary ENS domain name.

### Step 6: Threshold Key Splitting & Sealing
- A fresh 512-bit Data Encryption Key (DEK) is split into $(k, n)$ Shamir shares over $GF(256)$.
- Each share is sealed using an ephemeral X25519 authenticated Diffie-Hellman envelope addressed to the respective guardian's public key.

### Step 7: Natural-Language Carrier Generation
- Compact binary descriptor is transformed into innocuous English prose using a deterministic 256-word bijection wordmap.
- The carrier can be copied, emailed, or shared over ordinary communication channels.
