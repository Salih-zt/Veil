# VEIL — Multi-Layer Identity Integration

> **Document:** `IDENTITY_INTEGRATION.md`  
> **Repository:** `https://github.com/Salih-zt/Veil.git`  
> **Date:** 2026-11-06  

---

## 1. Identity Architecture Principles

Traditional encryption relies either on anonymous symmetric keys (susceptible to unauthorized leakage) or basic public-key cryptography (where holding the private key immediately unlocks the payload regardless of circumstances).

VEIL introduces **Multi-Layer Identity Governance**:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        VEIL IDENTITY VERIFICATION                      │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ 1. WALLET SIGNING  │ 2. PROOF-OF-LIFE   │ 3. DECENTRALIZED NAMING      │
│                    │                    │                              │
│ EIP-191 / SIWE     │ World ID 4.0       │ Ethereum Name Service (ENS)  │
│ Nonce challenge    │ Semaphore Groth16  │ Bidirectional match          │
│ Cryptographic proof│ Anti-Sybil zero-   │ Forward: name => address     │
│ of key control     │ knowledge nullifier│ Reverse: address => name     │
└────────────────────┴────────────────────┴──────────────────────────────┘
```

1. **Cryptographic Key Ownership**: Proved via EIP-191 personal signatures over random challenge nonces. Frontend claims are never trusted without cryptographic signature verification.
2. **Proof-of-Unique-Humanity**: Proved via World ID zero-knowledge proofs. Prevents bot swarms, Sybil attacks, and credential reuse through deterministic nullifiers scoped per capsule.
3. **Decentralized Naming & Address Attribution**: Proved via bidirectional ENS verification. Proves the user controls an authenticated, active Web3 domain name matching their public key.

---

## 2. Integration Points Across the Lifecycle

| Workflow Stage | Wallet Auth | World ID Verification | ENS Verification |
| :--- | :---: | :---: | :---: |
| **Account Onboarding** | Required (EIP-191) | Required | Optional / Recommended |
| **Room Creation** | Required (Owner) | Required | Optional |
| **Room Invitation Acceptance** | Required (Member) | Required | Required (if configured) |
| **Capsule Creation** | Required (Creator) | Enforced in Policy | Enforced in Policy |
| **Reviewer Voting** | Required (Reviewer) | N/A | Validated against whitelist |
| **Decryption Request** | Required (Recipient) | Required (Scoped to capsule) | Required (Bidirectional match) |
| **Guardian Share Release** | Required (Signed nonce)| Required (Fresh nullifier) | Validated against policy |

---

## 3. Data Minimization & Privacy Invariants

- **No Personally Identifiable Information (PII) Onchain**: Real names, email addresses, and phone numbers are never stored on smart contracts or exposed to guardians.
- **Nullifier Isolation**: World ID nullifiers are derived from the capsule action hash, preventing cross-capsule user tracking while strictly enforcing single-use replay defense.
- **Ephemeral Key Binding**: Every decryption request binds an ephemeral X25519 public key to the recipient's wallet signature and World ID signal hash, preventing man-in-the-middle key substitution.
