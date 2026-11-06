# VEIL Protocol — Security Specification & Threat Model

> **Protocol:** VEIL — Programmable Secret Capsules  
> **Classification:** Security Specification  
> **Status:** Phase 8 Hardened

---

## 1. Security Architecture & Threat Model

VEIL is designed under an adversarial model where:
1. Network traffic may be eavesdropped, recorded, altered, or intercepted by active Man-In-The-Middle (MITM) adversaries.
2. Individual threshold guardians may experience hardware failure, network outage, or malicious compromise.
3. Recipients may attempt early access before release conditions are satisfied.
4. Attackers may attempt to replay valid past signatures or zero-knowledge proofs.

---

## 2. Cryptographic Invariants

### 2.1 Zero Plaintext Invariant
- **Rule**: Neither the smart contract, the guardian services, nor the REST API server ever receives, stores, or processes plaintext secrets or unencrypted Data Encryption Keys (DEKs).
- **Enforcement**: Plaintext encryption and DEK destruction occur solely inside the client memory sandbox.

### 2.2 Threshold Fault Tolerance
- **Rule**: For a $(k, n) = (2, 3)$ deployment:
  - Any 1 compromised or rogue guardian learns zero bits of the DEK.
  - Any 1 offline or partitioned guardian does not prevent authorized disclosure.
  - Collusion of at least 2 guardians is required to reconstruct the key without recipient cooperation, mitigated by decentralized node ownership.

### 2.3 Policy AAD Tamper Resistance
- **Rule**: If an attacker modifies any field in the capsule descriptor (e.g. changing the policy hash, altering unlock timestamp, or replacing reviewer addresses), decryption fails catastrophically.
- **Enforcement**: RFC 5297 Synthetic IV verification guarantees integrity over `Ciphertext || AAD`.

### 2.4 Ephemeral Key Binding & MITM Resistance
- **Rule**: A relay adversary cannot intercept a valid World ID proof or Enterprise Credential and request key shares encrypted to their own key.
- **Enforcement**:
  - The World ID signal is defined as:
    $$\text{Signal} = \text{keccak256}(\text{recipientWallet} \parallel \text{ephemeralPubkey})$$
  - Guardians verify that the signed request's public key matches the signal commitment before encrypting the share.

### 2.5 Anti-Replay & Nullifier Invariants
- **Rule**: A released key share cannot be re-requested using duplicate nonces or replayed World ID proofs.
- **Enforcement**:
  - Each guardian records consumed World ID nullifiers and recipient nonces in its local encrypted SQLite database.
  - Replayed requests are rejected with `409 Conflict: NULLIFIER_ALREADY_USED`.

---

## 3. Vulnerability Reporting

If you identify a security issue in the VEIL protocol, contracts, or reference SDK:

1. **Do not open a public GitHub issue.**
2. Email the core cryptography team: `security@veil-protocol.io` (or PGP key `0xVEIL2026MUMBAI`).
3. Provide:
   - Reproduction script or test case.
   - Severity classification (Critical / High / Medium / Low).
   - Component affected (`VeilPolicyRegistry.sol`, SSS GF(256), `guardian.mjs`, or `gatebox.mjs`).

We commit to an initial response within 24 hours and coordinated public disclosure following standard vulnerability disclosure protocols.
