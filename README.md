# VEIL — Programmable Secret Capsules

> **Your secrets. Your conditions. Your control.**  
> *ETHGlobal Mumbai 2026 Submission*

VEIL is a programmable conditional-disclosure protocol that enables individuals, vulnerability researchers, whistleblowers, and organizations to conceal encrypted confidential payloads inside ordinary-looking, natural-language carrier text using exact reversible steganography.

Unlike conventional public-key or symmetric encryption where possession of the ciphertext yields the secret once a private key is known, a VEIL capsule **cannot be opened by mere possession of the message**. Decryption requires satisfiability of an immutable, verifiable onchain release policy enforced through a decentralized cluster of threshold key guardians, verifiable smart contracts, and zero-knowledge identity proofs.

---

## Core Protocol Pillars

```
┌────────────────────────────────────────────────────────────────────────┐
│                          VEIL PROTOCOL ARCHITECTURE                    │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ 1. REVERSIBLE      │ 2. THRESHOLD       │ 3. MULTI-LAYER               │
│    STEGANOGRAPHY   │    CRYPTOGRAPHY    │    RELEASE POLICIES          │
│                    │                    │                              │
│ 256-word bijection │ (k, n) Shamir over │ • Onchain Timelock           │
│ Covert transport   │ GF(256) field      │ • Reviewer Quorum Threshold  │
│ Zero metadata leak │ X25519 sealed box  │ • World ID 4.0 Proof-of-Life │
│ Bypasses DLP/cens. │ AES-256-SIV AEAD   │ • Enterprise Role Authority  │
└────────────────────┴────────────────────┴──────────────────────────────┘
```

1. **Reversible Steganographic Encoding**: Encodes the binary capsule descriptor into natural English prose using a deterministic 256-word token bijective wordmap. The carrier text is grammatically clean and completely reversible byte-for-byte.
2. **Threshold Secret Sharing & Sealed Envelopes**: The Data Encryption Key (DEK) encrypts the confidential payload using AES-256-SIV (Synthetic Initialization Vector) authenticated encryption with Additional Authenticated Data (AAD) bound to the onchain policy hash. The DEK is then split into $(k, n)$ Shamir shares over $GF(256)$, each sealed to independent threshold guardian public keys via ephemeral X25519 authenticated Diffie-Hellman boxes.
3. **Onchain Smart Contract Registry**: `VeilPolicyRegistry.sol` (Solidity 0.8.28, Foundry-tested) maintains immutable onchain commitments to policy parameters (unlock deadline, expiry, reviewer addresses, approval quorum) without ever receiving plaintext, DEKs, or private key material.
4. **Independent Guardian Cluster**: Nodes running isolated HTTP/SQLite services (Ports 8791, 8792, 8793) independently monitor onchain contract state, enforce anti-replay nullifiers, verify client signatures, and release sealed key shares only when all cryptographic conditions are satisfied.
5. **Decentralized & Enterprise Identity**: Combines World ID 4.0 Groth16 zero-knowledge Proof-of-Humanity with PayCore / Cerberus enterprise role authorization to prevent Sybil attacks and credential replay.

---

## Repository Structure

```text
veil protocol/
├── apps/
│   ├── web/                     # Cybersecurity dashboard (React 19, olive/sage theme)
│   └── api/                     # REST API service (Node.js microservice on port 8088)
├── packages/
│   ├── crypto/                  # SSS GF(256), AES-256-SIV, gatebox, wordmap steganography
│   ├── sdk/                     # @veil-protocol/sdk (VeilClient, adapters, errors)
│   └── guardian/                # Independent guardian node, cluster orchestrator, SQLite store
├── contracts/
│   ├── src/                     # VeilPolicyRegistry.sol
│   ├── test/                    # VeilPolicyRegistry.t.sol (20/20 Foundry tests passed)
│   ├── script/                  # DeployVeilPolicyRegistry.s.sol
│   └── foundry.toml
├── examples/
│   └── vulnerability-disclosure/ # Coordinated vulnerability embargo disclosure scenario
├── docs/
│   ├── architecture/            # System overview, state machines, sequence diagrams
│   ├── developers/              # SDK guide, adapter architecture, error catalog
│   ├── security/                # Formal threat model, cryptographic invariants
│   └── deployment/              # Local testnet & cluster deployment guides
├── scripts/
│   ├── test-all.mjs             # Unified automated test runner (100% pass)
│   ├── demo-e2e.mjs             # 9-step end-to-end interactive protocol walkthrough
│   ├── start-guardians.mjs      # Cluster orchestrator launcher (8791, 8792, 8793)
│   └── start-api.mjs            # REST API service launcher (8088)
├── test/
│   ├── unit/                    # 81 Unit tests (Crypto, SSS, Identity, SDK, Workflow)
│   ├── integration/             # Guardian HTTP cluster & REST API integration tests
│   └── lib/                     # Module resolution hooks
├── .env.example                 # Zero-secret environment template
├── .gitignore                   # Leak-prevention filter rules
├── package.json                 # Monorepo workspaces configuration
├── ARCHITECTURE.md              # Architectural specification
├── SECURITY.md                  # Security model & vulnerability reporting policy
├── LICENSE                      # MIT License
├── PHASE_8_MIGRATION_REPORT.md  # Detailed project extraction log
├── PHASE_8_SECURITY_AUDIT.md    # Security audit report
├── PHASE_8_TEST_REPORT.md       # Full test execution verification report
├── PHASE_8_DEMO_SCRIPT.md       # Judge & evaluator presentation walk-through
└── PHASE_8_KNOWN_LIMITATIONS.md # Documented production scope & roadmap
```

---

## 🏆 ETHGlobal Judge Demo: Northstar Payments (`CVE-2026-8812`)

A complete, human-operated demonstration experience designed specifically for ETHGlobal judges and evaluators. Real participants sign in with their Ethereum wallets, conceal zero-day vulnerability disclosures inside natural English steganography, enforce multi-party onchain governance, and demonstrate cryptographic fail-closed states before authorized client-side decryption.

### 📚 Demo Documentation
- **[Judge Demo Runbook (`DEMO_RUNBOOK.md`)](DEMO_RUNBOOK.md)**: Screen-by-screen walkthrough, presentation timing, and operator guidance.
- **[Demo Accounts & Key Directory (`DEMO_ACCOUNTS.md`)](DEMO_ACCOUNTS.md)**: Details of Alice, Bob, Charlie, David, and Eve (addresses, roles, MetaMask import guides).
- **[Demo Scenario Specification (`DEMO_SCENARIO.md`)](DEMO_SCENARIO.md)**: Deep dive into the Northstar Payments double-credit race condition (`CVE-2026-8812`) and release policy.

### 🚀 Running the Human-Operated Demo
Launch the zero-dependency interactive web dashboard on `http://localhost:3000`:

```bash
# 1. Start Local Anvil Testnet (Terminal 1)
npm run anvil
# (Runs bundled .\contracts\anvil.exe on port 8545)

# 2. Deploy Policy Registry Contract (Terminal 2)
npm run deploy:contracts
# (Runs bundled .\contracts\forge.exe deployment script)

# 3. Start Guardian Cluster (Terminal 3)
npm run guardians

# 4. Start REST API (Terminal 4)
npm run api

# 5. Start Web Dashboard (Terminal 5)
npm run serve
```

Open **`http://localhost:3000`** in your browser to begin the walkthrough.

---

## Quickstart & Verification

### 1. Prerequisites
- Node.js >= 22.0.0 (Native TypeScript stripping enabled)
- Foundry (`forge` and `anvil`) for EVM contract execution

### 2. Run Comprehensive Automated Tests
Run the entire test suite (Solidity contracts, crypto unit tests, SDK tests, and scenario walkthrough) with a single command:

```bash
node scripts/test-all.mjs
```

### 3. Run the 9-Step Interactive Protocol Walkthrough
Demonstrates Alice creating a capsule, steganographic carrier text generation, Bob receiving the cover text, early access denial, multi-party reviewer approval onchain, deadline expiration, World ID + PayCore identity verification, threshold guardian share release, client-side DEK reconstruction, and receipt generation:

```bash
node --import ./test/lib/resolve-ts.mjs scripts/demo-e2e.mjs
```

### 4. Run the Vulnerability Embargo Scenario
Demonstrates coordinated vulnerability disclosure using the `@veil-protocol/sdk`:

```bash
node --import ./test/lib/resolve-ts.mjs examples/vulnerability-disclosure/run-scenario.ts
```

### 5. Launch Guardian Cluster & REST API
Start the 3 independent guardian services:
```bash
node scripts/start-guardians.mjs
# Guardians listening on http://127.0.0.1:8791, :8792, :8793
```

In another terminal, start the REST API:
```bash
node scripts/start-api.mjs
# REST API running on http://127.0.0.1:8088
```

---

## Cryptographic Specifications

- **Envelope Encryption**: AES-256-SIV (RFC 5297) deterministic AEAD with 512-bit master key (`K_mac || K_enc`).
- **Additional Authenticated Data (AAD)**: The 32-byte canonical `policyHash` calculated as `keccak256(abi.encode(capsuleId, creator, ciphertextHash, unlockTimestamp, expiryTimestamp, threshold, reviewers))` is strictly bound as AAD to the ciphertext. Any modification of policy parameters causes decryption failure.
- **Threshold Secret Sharing**: $(k, n)$ polynomial Shamir Secret Sharing evaluated over Galois Field $GF(2^8) = GF(256)$ with irreducible polynomial $p(x) = x^8 + x^4 + x^3 + x + 1$ (0x11b). Reconstructs 64-byte DEK in memory via Lagrange interpolation.
- **Key Transport Security**: Ephemeral X25519 Diffie-Hellman + HKDF-SHA256 + AES-256-SIV sealed boxes (`veil.gatebox.v1`). Key shares are never transmitted in plaintext over the wire.
- **Anti-Replay Architecture**: Guardians maintain encrypted SQLite nullifier databases tracking recipient nonces and World ID nullifiers. Request TTL is capped to 300 seconds.

---

## License

MIT © 2026 VEIL Protocol Contributors (ETHGlobal Mumbai 2026).
