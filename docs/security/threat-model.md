# VEIL — Threat Model & Security Analysis

## 1. Trust Assumptions & Threat Actors

| Actor | Capability | Trust Level | Mitigations |
|---|---|---|---|
| **Eavesdropper** | Monitors carrier text and network traffic | Zero | Reversible steganography hides descriptor; AES-256-SIV encrypts payload |
| **Recipient (Premature)** | Possesses carrier text before conditions are met | Low | SSS $(k, n)$ secret sharing: DEK cannot be reconstructed without guardian shares |
| **Single Rogue Guardian** | Compromised guardian node trying to leak secrets | Low | $k=2$ threshold required; single share reveals zero plaintext |
| **Relay / MITM Attacker** | Intercepts World ID or Org credentials | Untrusted | Proof signal commits to `keccak256(recipient || ephemeralPubkey)` |
| **Colluding Guardians** | Multiple guardians colluding without authorization | Threshold | Requires $k$ of $n$ collusion; mitigated by multi-party governance and decentralized node deployment |

---

## 2. Adversarial Scenarios & Verification

### Scenario A: Early Access Attempt
- **Attack**: Bob obtains carrier text and requests shares before timelock passes or reviewers vote.
- **Defense**: Guardians query the onchain `isReleaseReady()` view function. If false, guardians refuse to release shares with `403 Forbidden: POLICY_CONDITIONS_NOT_SATISFIED`.

### Scenario B: Tampered Policy Parameters
- **Attack**: Attacker intercepts descriptor and lowers the threshold from 2 to 1, or changes the timelock.
- **Defense**: The onchain policy hash `policyHash` is bound as Additional Authenticated Data (AAD) in the AES-256-SIV envelope. Decryption throws authentication tag mismatch.

### Scenario C: Replay of World ID Nullifier
- **Attack**: Recipient attempts to reuse a valid World ID proof for multiple capsules or access requests.
- **Defense**: Guardians record nullifiers in persistent SQLite stores with atomic checks. Duplicate nullifiers return `409 Conflict`.

### Scenario D: Credential Relay Attack
- **Attack**: Eve intercepts Bob's World ID proof and forwards it to guardians with Eve's public key.
- **Defense**: The proof signal commits to `keccak256(BobAddress || BobEphemeralPubkey)`. Eve's request is rejected during signal verification.
