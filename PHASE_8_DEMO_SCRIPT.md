# VEIL — ETHGlobal Mumbai 2026 Live Demo Script

> **Product:** VEIL — Programmable Secret Capsules  
> **Tagline:** Your secrets. Your conditions. Your control.  
> **Target Audience:** Hackathon Judges, Security Researchers, Enterprise Key Custodians

---

## 1. 30-Second Elevator Pitch

"Traditional encrypted messaging suffers from a fatal flaw: once you send an encrypted payload, whoever possesses the ciphertext can decrypt it whenever they gain a key, and corporate/state content filters flag ciphertexts immediately.

VEIL changes the paradigm with **Programmable Secret Capsules**.

We embed encrypted secrets inside ordinary-looking English text using reversible steganography. Furthermore, possession of the message does **not** grant access. The secret is split into Shamir shares distributed to independent threshold guardians, and can only be unlocked when verifiable onchain conditions are satisfied:
1. An onchain timelock deadline passes.
2. A multi-party quorum of designated reviewers approves the release.
3. The recipient proves real human identity via World ID 4.0 and organizational authorization via PayCore.

Only then do guardians release their shares, allowing the recipient to reconstruct the key locally."

---

## 2. Live Walkthrough Demonstration (Step-by-Step)

### Step 1: Run the Interactive End-to-End Walkthrough
Command:
```bash
node --import ./test/lib/resolve-ts.mjs scripts/demo-e2e.mjs
```

Observe in Terminal:
1. **Alice creates the capsule**: Encrypts zero-day commit advisory with AES-256-SIV, splits DEK into 3 Shamir shares ($k=2$), registers onchain policy with 1-hour embargo, 2 reviewers, World ID + PayCore requirement.
2. **Stego carrier generated**: 198 ordinary-looking English words generated.
3. **Bob receives cover text**: Decodes carrier text. Status shows `LOCKED`.
4. **Early Access Denied**: Bob queries guardians before conditions met. Guardians refuse access with `INSUFFICIENT_SHARES`.
5. **Reviewers Vote**: Reviewer 1 and Reviewer 2 sign onchain approvals. Quorum met!
6. **Time Advances**: Simulated clock passes the 1-hour embargo deadline.
7. **Identity Verification**: Bob presents valid World ID 4.0 Groth16 proof and PayCore Security Lead credential.
8. **Threshold Release**: Guardians Alpha, Beta, Gamma independently sign and release sealed shares.
9. **Client Decryption**: Bob unseals shares in browser memory, reconstructs DEK via Lagrange interpolation in $GF(256)$, opens AES-SIV envelope, and receives verifiable cryptographic receipt.

---

### Step 2: Run the Developer SDK Vulnerability Embargo Scenario
Command:
```bash
node --import ./test/lib/resolve-ts.mjs examples/vulnerability-disclosure/run-scenario.ts
```

Demonstrates how external security teams and bug bounty platforms integrate VEIL using `@veil-protocol/sdk` with clean async APIs.

---

### Step 3: Cybersecurity Web Dashboard
Command:
```bash
cd apps/web && npm run dev
```
Open `http://localhost:3000` to show:
- Capsule Creator view (Alice).
- Inspect & Reveal view (Bob).
- Reviewer Portal with live signature approvals.
- Guardian Cluster status matrix (ports 8791, 8792, 8793).
- World ID 4.0 & Enterprise Role verification console.
