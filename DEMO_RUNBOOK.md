# VEIL — Human-Operated Product & Judge Demo Runbook

> **Event:** ETHGlobal Mumbai 2026  
> **Application URL:** `http://localhost:3000`  
> **Product Tagline:** Your secrets. Your conditions. Your control.  
> **Demonstration:** Real Multi-User Collaborative Encryption, Private Rooms, Dynamic M-of-N Quorum & Decryption  

---

## 1. Quick Verification & Startup Checklist

Open 5 terminal windows in `D:\ethglobal\veil protocol`:

| Terminal | Process | Command | Description |
| :--- | :--- | :--- | :--- |
| **Terminal 1** | **EVM Anvil Testnet** | `npm run anvil` | Deterministic local blockchain on `127.0.0.1:8545` (Chain ID `31337`). |
| **Terminal 2** | **Deploy Contracts** | `npm run deploy:contracts` | Broadcasts `VeilPolicyRegistry.sol` to Anvil. |
| **Terminal 3** | **Guardian Cluster** | `npm run guardians` | Launches Guardian Alpha (8791), Beta (8792), Gamma (8793). |
| **Terminal 4** | **REST API Server** | `npm run api` | Starts API on `127.0.0.1:8088` with SQLite database. |
| **Terminal 5** | **Web Application** | `npm run serve` | Serves web app on `http://localhost:3000`. |

---

## 2. Real Multi-User Product Demonstration Walkthrough

Open **`http://localhost:3000`** in your browser.

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                                REAL MULTI-USER WORKFLOW                                │
├──────────────────────────┬───────────────────────────────┬─────────────────────────────┤
│ TAB 1: ALICE (CREATOR)   │ TAB 2: REVIEWERS (CHARLIE/ETC)│ TAB 3: BOB (RECIPIENT)      │
│                          │                               │                             │
│ 1. Connects MetaMask     │ 1. Opens room invitation      │ 1. Receives carrier link    │
│ 2. Creates Private Room  │ 2. Joins room with wallet     │ 2. Detected as Recipient    │
│ 3. Invites teammates     │ 3. Reviews pending request    │ 3. Early access denied      │
│ 4. Sets 4-of-5 Quorum    │ 4. Signs onchain approval     │ 4. Decrypts locally         │
│ 5. Encrypts & gets link  │ 5. Quorum reached!            │ 5. Secret plaintext shown!  │
└──────────────────────────┴───────────────────────────────┴─────────────────────────────┘
```

---

### Step 1: Alice Connects Wallet & Creates Private Room
1. In the top bar, click **"Connect Wallet"** to connect MetaMask, or use the **Quick Switch** dropdown to select **Alice**.
2. Go to **🪪 World ID & ENS Compliance**:
   - Click **"Generate & Verify World ID Proof"** (Semaphore Groth16 Proof-of-Humanity).
   - Enter `alice.veil.eth` and click **"Verify Bidirectional ENS Record"**.
3. In the sidebar, click **"+ Create Private Room"**:
   - Room Name: `Northstar Settlement Vulnerability Response Vault`
   - Description: `Private coordinated disclosure room for CVE-2026-8812`
   - Click **"Create Room & Become Owner"**.

---

### Step 2: Invite Teammates with Single-Use Secure Links
1. Inside the room, scroll to **"Invite New Participant"**:
   - Select role: `Approver`
   - Click **"Generate Invitation Link"**.
2. Copy the generated single-use invitation link (e.g. `http://localhost:3000/invite/<raw-token>`).
3. *(Optional Multi-Browser Test)*: Open this link in an incognito window or new tab:
   - Connect Bob or Charlie's wallet.
   - Click **"Accept Invitation & Enter Room"**.
   - Notice the member list immediately updates to show their verified wallet, role, and ENS identity!

---

### Step 3: Alice Encrypts Capsule with Dynamic 4-of-5 Quorum
1. In the sidebar, click **"🔒 Encrypt & Share Capsule"**:
   - **Confidential Secret:** Enter vulnerability details or custom text.
   - **Access Mode:** `Named Recipient` (Bob: `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC`).
   - **Reviewer Quorum:** Enter 5 eligible approvers (Alice, Charlie, David, Eve, Bob) and set **Threshold (M): 4**.
   - **Timelock:** Set `60` seconds embargo.
   - **Identity:** Check World ID 4.0 and ENS required.
2. Click **"🔒 Encrypt Capsule & Generate Natural Carrier Text"**:
   - Payload is encrypted with **AES-256-SIV AEAD** in browser memory.
   - DEK is split into Shamir shares over **Galois Field $GF(256)$**.
   - Sealed key shares are deposited with Guardians Alpha, Beta, and Gamma.
   - Capsule policy is registered onchain.
   - Natural English carrier text is generated via the **256-word bijection codec**.
3. Click **"Copy Link"** (e.g. `http://localhost:3000/decrypt?capsule=0x...#c=...`).

---

### Step 4: Bob Opens the Link & Tests Fail-Closed Security
1. Open a new browser tab and paste the link.
2. The portal immediately loads the **Decoder & Decryption Reveal Portal**:
   - The carrier text is automatically ingested and reversed.
   - Status shows: `4 of 5 Approvals Required · 0 Received · Embargo Active`.
3. Switch wallet identity to **Bob** (`0x3C44...`).
4. Click **"Test Early Access (Demonstrate Fail-Closed Security)"**:
   - Guardians refuse release with `423 Locked: Policy Unsatisfied`.
   - Explains to judges: *Possession of the carrier text yields zero information about the secret until conditions are met.*
5. Click **"1. Submit Decryption Request (Sign with Wallet)"**:
   - Bob signs the release request with his wallet, presenting his World ID nullifier and ENS attestation.

---

### Step 5: Room Reviewers Cast Onchain Approval Votes
1. In the sidebar, go to **"✓ Reviewer Approvals"** (or switch to Charlie, David, or Eve).
2. The pending decryption request appears with full capsule details.
3. Reviewers click **"✓ Sign Approval on Blockchain"**:
   - Charlie approves $\to$ Quorum: $1 / 4$.
   - David approves $\to$ Quorum: $2 / 4$.
   - Alice approves $\to$ Quorum: $3 / 4$.
   - Eve approves $\to$ Quorum: **$4 / 4$ (QUORUM REACHED!)**.

---

### Step 6: Embargo Elapses & Client Decrypts
1. Return to the **Decoder & Reveal Portal** (`/decrypt`).
2. When the 60-second embargo expires, the status updates to:
   **`RELEASE READY`**.
3. A large green button appears: **"2. 🔓 Unseal Guardian Shares & Decrypt Secret"**.
4. Bob clicks it:
   - Guardians deliver sealed shares.
   - Bob's browser unseals the shares using his ephemeral private key.
   - DEK is reconstructed in transient memory via $GF(256)$ Lagrange interpolation.
   - AES-256-SIV AEAD decrypts the secret.
   - **The cleartext confidential message appears directly on screen!**
   - The complete cryptographic **Disclosure Receipt** is displayed.

---

## 3. Automated Acceptance Test

To execute the 34-step automated verification:

```bash
npm run test:product
```
*Result: `✔ 34-STEP PRODUCT ACCEPTANCE SCENARIO PASSED WITH 100% SUCCESS!`*
