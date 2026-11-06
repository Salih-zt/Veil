# VEIL — Phase 8 Known Limitations & Future Scope

> **Project:** VEIL — Programmable Secret Capsules  
> **Status:** Production Roadmap & Known Scope Boundaries

---

## 1. Documented Architectural Scope

### 1.1 Local Guardian Cluster Deployment
- **Current State**: The three independent guardians run locally on ports `8791`, `8792`, and `8793` for hackathon and integration demonstration.
- **Production Scope**: Nodes should run in geographically separated sovereign environments across distinct cloud/datacenter providers, using dedicated Hardware Security Modules (HSMs) or Cloud KMS for ECDSA signing keys.

### 1.2 Onchain Gas Optimization
- **Current State**: `VeilPolicyRegistry.sol` is optimized with Cancun EVM settings (200 optimizer runs).
- **Future Scope**: For high-volume deployment on Ethereum Mainnet or L2s, reviewer signatures can be aggregated via EIP-712 offchain signatures submitted in a single batched transaction by a relayer.

### 1.3 Steganographic Lexicon Scalability
- **Current State**: The pure JavaScript wordmap codec maps 256 common English words to single bytes ($0 \dots 255$).
- **Future Scope**: Expand token dictionaries to support multi-language vocabulary (Spanish, Mandarin, French) and variable-length arithmetic coding for denser payload embeddings.

### 1.4 Formal Verification
- **Current State**: 20/20 Foundry unit tests and 81/81 TypeScript/JavaScript unit tests verify state invariants and edge cases.
- **Future Scope**: Formal verification of `VeilPolicyRegistry.sol` using Certora or Halmos to mathematically prove the absence of reentrancy and access control bypasses.
