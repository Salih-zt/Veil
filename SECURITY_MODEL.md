# VEIL — Protocol Security Model & Threat Analysis

> **Document:** `SECURITY_MODEL.md`  
> **Repository:** `https://github.com/Salih-zt/Veil.git`  
> **Date:** 2026-11-06  

---

## 1. Cryptographic Foundations

VEIL is designed under the principle of **provable defense-in-depth**:

1. **Envelope Encryption (AES-256-SIV AEAD)**: Uses RFC 5297 Synthetic Initialization Vector with two 256-bit subkeys ($K_{\text{mac}} \,\|\, K_{\text{enc}}$). Prevents nonce-misuse vulnerabilities and binds the 32-byte `policyHash` as Additional Authenticated Data (AAD). Any tampering with policy parameters causes authenticated decryption failure.
2. **Threshold Secret Sharing ($GF(256)$)**: The DEK is split using polynomial Shamir Secret Sharing over Galois Field $GF(2^8) = GF(256)$ with irreducible polynomial $p(x) = x^8 + x^4 + x^3 + x + 1$ ($0x11b$). A $(k, n)$ scheme ensures that any $k - 1$ shares reveal **exactly 0 bits of information** about the key.
3. **Sealed Box Key Transport**: Key shares are encrypted using ephemeral X25519 Diffie-Hellman + HKDF-SHA256 + AES-256-SIV boxes (`veil.gatebox.v1`). Key shares are never transmitted in plaintext.
4. **Reversible Steganography**: Uses a 256-word bijection wordmap. Each byte ($0x00 \dots 0xFF$) deterministically maps to a single natural English token. Completely reversible byte-for-byte.

---

## 2. Threat Analysis & Mitigations

| Threat Vector | Attack Scenario | Protocol Mitigation |
| :--- | :--- | :--- |
| **Premature Ciphertext Compromise** | Adversary intercepts carrier text before embargo expiration. | **Threshold Protection**: Carrier contains only ciphertext and public descriptor. Possession of ciphertext reveals zero bits of the DEK without guardian threshold release. |
| **Unauthorized Share Harvesting** | Rogue actor requests shares from guardians before approvals. | **Fail-Closed Guardians**: Nodes independently query smart contract state via RPC. If quorum or timelock is unsatisfied, release returns `423 Locked`. |
| **Sybil & Bot Requests** | Attacker spins up hundreds of automated wallets to bypass quorums. | **World ID 4.0 Proof-of-Humanity**: Every request requires a valid Semaphore Groth16 zero-knowledge proof with an unspent nullifier. |
| **Man-in-the-Middle Key Substitution** | Adversary intercepts valid World ID proof and substitutes their own key. | **Signal Binding**: World ID signal strictly binds `keccak256(recipientAddress || ephemeralPubkey)`. Mismatched keys cause immediate proof rejection. |
| **Identity Spoofing** | User claims a high-profile name in a frontend form. | **Bidirectional ENS Verification**: Asserts `forward(name) === address` and `reverse(address) === name` onchain. |
| **Replay Attacks** | Malicious participant resubmits old signed release requests. | **Anti-Replay Nonce Tracking**: Single-use nonces and nullifiers are recorded in persistent SQLite stores with 300s TTL. |
| **Server Database Compromise** | Attacker obtains full read access to API SQLite database. | **Zero Plaintext Invariant**: Database stores only ciphertext hashes, public commitments, and encrypted payloads. No DEKs or plaintexts exist in the DB. |
