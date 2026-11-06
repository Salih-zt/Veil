# VEIL — System Overview & Architecture

## Executive Summary

VEIL is an information disclosure protocol built on EVM smart contracts, threshold secret sharing over Galois Field $GF(256)$, reversible steganography, and zero-knowledge identity proofs.

It enables time-delayed, multi-party approved, and identity-gated cryptographic secrets to be transmitted across standard messaging channels (e.g. email, Twitter, Discord, SMS) disguised as ordinary natural-language text.

---

## Component Architecture

### 1. Reversible Steganographic Codec (`packages/crypto/codec/wordmap.mjs`)
- Standard cryptographic ciphertexts (base64, hex, binary) are immediately identifiable by automated network filters, corporate Data Loss Prevention (DLP) engines, and state firewalls.
- VEIL uses a deterministic 256-word token dictionary mapping each byte ($0 \dots 255$) to a common English word.
- Words are assembled into grammatically plausible sentences with punctuation and spacing.
- The decoding algorithm strips formatting, looks up dictionary indices, and reconstructs the exact original binary payload without loss.

### 2. Envelope Cryptography (`packages/crypto/capsule.mjs`)
- Utilizes AES-256-SIV (Synthetic Initialization Vector, RFC 5297) for authenticated encryption.
- Master key length: 512 bits (64 bytes).
- AAD (Additional Authenticated Data): `policyHash` computed from onchain parameters.
- If policy parameters are manipulated in transport, decryption fails unconditionally.

### 3. Threshold Secret Sharing (`packages/crypto/sss.mjs`)
- Employs $(k, n)$ polynomial Shamir Secret Sharing over Galois Field $GF(2^8)$.
- Field arithmetic: $p(x) = x^8 + x^4 + x^3 + x + 1$ (0x11b).
- Evaluates independent polynomials for each byte of the 64-byte DEK.
- Guarantees information-theoretic security: $k-1$ shares contain zero statistical information regarding the secret.

### 4. Smart Contract Policy Registry (`contracts/src/VeilPolicyRegistry.sol`)
- Enforces access control and lifecycle states:
  - `createCapsule()`: Registers policy hash, unlock timestamp, expiry, and reviewers.
  - `approveRelease()`: Records reviewer votes toward the required quorum.
  - `isReleaseReady()`: Verifies if deadline has passed, quorum is met, and capsule is active.
  - `revokeCapsule()`: Allows the creator to revoke unreleased capsules.
  - `authorizeRecipient()`: Binds approved recipient addresses onchain.

### 5. Guardian Network (`packages/guardian/`)
- Microservices operating on ports 8791, 8792, and 8793.
- Key shares stored encrypted at rest using node-derived AES-256-SIV.
- Node releases sealed shares only when onchain state returns `isReleaseReady() == true`.
- Verifies recipient identity, World ID nullifiers, and enterprise authorization before release.
