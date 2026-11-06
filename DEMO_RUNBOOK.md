# VEIL — Human-Operated Judge Demo Runbook

> **Event:** ETHGlobal Mumbai 2026  
> **Demonstration:** Coordinated Vulnerability Disclosure at Northstar Payments (`CVE-2026-8812`)  
> **Application URL:** `http://localhost:3000`  
> **Estimated Presentation Time:** 5 – 7 minutes  

---

## 1. Quick Verification & Startup Checklist

Before beginning the judge presentation, ensure the environment is initialized.

### Terminal 1: Local EVM Anvil Testnet
```bash
cd "D:\ethglobal\veil protocol"
npm run anvil
# Or directly: .\contracts\anvil.exe --port 8545 --chain-id 31337
```

### Terminal 2: Deploy Policy Registry Contract
```bash
cd "D:\ethglobal\veil protocol"
npm run deploy:contracts
# Or directly: .\contracts\forge.exe script contracts/script/DeployVeilPolicyRegistry.s.sol:DeployVeilPolicyRegistry --rpc-url http://127.0.0.1:8545 --broadcast
```

### Terminal 3: Start 3-Node Independent Guardian Cluster
```bash
cd "D:\ethglobal\veil protocol"
node scripts/start-guardians.mjs
```
*Verifies: Guardian Alpha (8791), Guardian Beta (8792), and Guardian Gamma (8793) start with isolated SQLite databases and X25519 keypairs.*

### Terminal 4: Start VEIL REST API Server
```bash
cd "D:\ethglobal\veil protocol"
node scripts/start-api.mjs
```
*Verifies: REST API initializes on `http://127.0.0.1:8088`.*

### Terminal 5: Start Zero-Dependency Web Dashboard
```bash
cd "D:\ethglobal\veil protocol"
node scripts/serve-web.mjs
```
*Verifies: Web dashboard is accessible at `http://localhost:3000`.*

---

## 2. Screen-by-Screen Judge Presentation Walkthrough

### Act I: The Discovery & Capsule Creation (Alice)

1. **Open Dashboard:**
   - Navigate to `http://localhost:3000` in Google Chrome or Brave.
   - The interface loads the **Northstar Payments Cybersecurity Workspace**.

2. **Authenticate Alice:**
   - In the top header bar, select **"Alice (White-Hat Researcher)"** from the quick switcher or connect MetaMask with account `0x70997970C51812dc3A010C7d01b50e0d17dc79C8`.
   - Click **"Sign In with Ethereum"**.
   - Explain to judges: *“VEIL uses real EIP-191 cryptographic challenge-response signatures. Alice's identity is cryptographically verified, not spoofed via a form.”*

3. **Configure Capsule & Policy:**
   - In the **Capsule Creator** panel, observe the pre-filled advisory for `CVE-2026-8812`:
     - **Title:** `Critical Concurrency Settlement Race (CVE-2026-8812)`
     - **Confidential Payload:** Exploit PoC and internal patch commit hash.
     - **Embargo Timelock:** `90 seconds` *(shortened for live judge demo)*.
     - **Reviewer Quorum:** `2 of 3` required (`Charlie`, `David`, `Eve`).
     - **Guardians:** `3` nodes configured, threshold `2` required.
     - **Identity Policy:** World ID 4.0 Groth16 proof required + Northstar Payments `Security Lead` credential.

4. **Execute Encryption & Registration:**
   - Click **"Lock Secret & Create Capsule"**.
   - Highlight the live cryptographic pipeline executing:
     1. Random 256-bit Data Encryption Key (DEK) generated.
     2. Payload encrypted with **AES-256-SIV AEAD**, binding the policy hash as authenticated data.
     3. DEK split into 3 Shamir shares over Galois Field $GF(256)$.
     4. Each share sealed to Guardian Alpha, Beta, and Gamma public keys via X25519 sealed boxes.
     5. Immutable policy registered on Anvil via `VeilPolicyRegistry.sol`.
     6. Binary descriptor transformed into natural English carrier text using the 256-word bijection wordmap.
   - Click **"Copy Carrier Text"** and show the judges the innocuous paragraph of text.

---

### Act II: Interception & Fail-Closed Early Access (Bob)

5. **Authenticate Bob:**
   - In the top header, switch identity to **"Bob (Security Lead)"** (`0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`).
   - Click **"Sign In with Ethereum"**.

6. **Inspect Carrier Text:**
   - Paste the carrier text into the **Receive & Decrypt** panel.
   - Click **"Decode Carrier Text"**.
   - Show judges:
     - The stego codec reverses the text byte-for-byte into the binary descriptor.
     - The policy hash is verified against the Anvil smart contract.
     - Contract status indicates: **Embargo Active** (e.g., 75s remaining), **Reviewer Quorum Unsatisfied** (0 of 2 approvals).

7. **Demonstrate Fail-Closed Security (Early Access Denial):**
   - Click **"Attempt Early Decryption"**.
   - The screen displays a red security denial banner:
     ```text
     POLICY REJECTED (403 Forbidden)
     • Timelock: EMBARGO ACTIVE (72s remaining)
     • Quorum: 0 of 2 approvals recorded onchain
     • Key Guardians: Release rejected
     ```
   - Explain to judges: *“Even though Bob holds the complete stego carrier, he has zero mathematical capability to decrypt. The secret remains protected.”*

---

### Act III: Governance & Quorum Approval (Charlie & David)

8. **Reviewer 1 Approval (Charlie):**
   - Switch identity to **"Charlie (VP of Engineering)"** (`0x90F79bf6EB2c4f870365E785982E1f101E93b906`).
   - Authenticate with SIWE.
   - In the **Reviewer Portal**, inspect the pending capsule ID.
   - Click **"Sign Approval on Blockchain"**.
   - Charlie's approval transaction is mined on Anvil. Quorum updates to **1 of 2**.

9. **Reviewer 2 Approval (David):**
   - Switch identity to **"David (Core Architect)"** (`0x35B33Ae737809aa6B03fe4124B760E14e5d996a0`).
   - Authenticate with SIWE.
   - Click **"Sign Approval on Blockchain"**.
   - David's approval transaction is mined on Anvil. Quorum updates to **2 of 2 (Quorum Satisfied!)**.

10. **Embargo Expiration:**
    - Watch the countdown timer in the header reach `00:00`.
    - Both onchain requirements (timelock + quorum) are now satisfied!

---

### Act IV: Identity Verification & Threshold Failure (Bob)

11. **Switch Back to Bob:**
    - Switch identity to **"Bob (Security Lead)"** (`0x3C44...`).
    - Authenticate with SIWE.

12. **Generate Identity Proofs:**
    - Under the **Identity Verification** section:
      - Click **"Generate World ID 4.0 Proof"**: Generates a Semaphore Groth16 zero-knowledge proof binding Bob's address and an ephemeral X25519 recipient key to the capsule action.
      - Click **"Obtain Northstar Role Credential"**: Attests Bob is `Security Lead` at `northstar`, signed by the Northstar Identity Authority (`0x71C8...`).

13. **Demonstrate 1-Guardian Threshold Failure ($K=1$ of 2):**
    - Click **"Test Threshold Failure (Request 1 Share Only)"**.
    - Bob receives 1 sealed share from Guardian Alpha.
    - Bob attempts Lagrange interpolation over $GF(256)$.
    - The client fails closed with `INSUFFICIENT_SHARES_FOR_INTERPOLATION`.
    - Explain to judges: *“Shamir Secret Sharing is information-theoretically secure. Possessing 1 share out of a 2-share threshold reveals zero information about the 256-bit DEK.”*

---

### Act V: Full Disclosure & Cryptographic Receipt

14. **Collect 2nd Share & Decrypt:**
    - Click **"Authorized Release (Collect Threshold Shares & Decrypt)"**.
    - Watch the live execution steps:
      1. Guardian Beta validates the onchain policy, Bob's signature, World ID proof, and role credential.
      2. Guardian Beta releases sealed Share #2.
      3. Bob's browser unseals Share #1 and Share #2 using his ephemeral X25519 private key.
      4. $GF(256)$ Lagrange interpolation reconstructs the exact 256-bit DEK in transient memory.
      5. AES-256-SIV AEAD validates integrity and decrypts the secret.
    - The decrypted vulnerability advisory and patch commit appear in cleartext!

15. **Inspect the Verifiable Disclosure Receipt:**
    - Scroll to the generated **Disclosure Receipt**:
      - **Receipt ID:** Unique cryptographic identifier.
      - **Policy Hash:** Matches onchain contract commitment.
      - **World ID Nullifier:** Proves one-time proof-of-humanity without tracking identity.
      - **Organization Credential:** Verifiable ECDSA signature from Northstar Payments.
      - **Guardian Signatures:** Attestations from Guardian Alpha and Guardian Beta.
    - Conclude: *“At no point did any guardian, contract, or network observer see the secret or the decryption key. Only Bob, at the authorized time and with authorized approvals, was able to reconstruct it.”*

---

## 3. Trouble-Shooting & Reset Commands

If you need to reset the demonstration state to run again:

```bash
# In "veil protocol" directory:
# 1. Clean guardian SQLite databases
rm packages/guardian/data/*.sqlite

# 2. Restart anvil and re-run deploy script
# (Or run the automated integration test to verify clean state):
node --import ./test/lib/resolve-ts.mjs --test test/integration/demo-workflow.test.mjs
```
