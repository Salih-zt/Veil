# VEIL — Demo Accounts & Identity Specification

> **Target Scenario:** Northstar Payments Coordinated Disclosure (`CVE-2026-8812`)  
> **Network:** Local Foundry Anvil Testnet (`http://127.0.0.1:8545`, Chain ID `31337`)  
> **Security Notice:** The private keys below are standard deterministic Anvil test keys. **NEVER use these keys on mainnet or any live public network.**

---

## 1. Participant Directory

The demo involves five distinct human or programmatic roles. In VEIL, authorization is **strictly derived from the authenticated wallet address and onchain state**. No user can claim a role merely by selecting an option in a UI dropdown.

| Participant | Role | Address | Local Anvil Private Key | Permissions & Capabilities |
| :--- | :--- | :--- | :--- | :--- |
| **Alice** | Vulnerability Researcher | `0x70997970C51812dc3A010C7d01b50e0d17dc79C8` | `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d` | • Creates capsules<br>• Splits & deposits guardian shares<br>• Registers policies onchain |
| **Bob** | Authorized Recipient | `0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC` | `0x5de4111afa1a4b94908f83103eb2f954b09a470d4c628a215a5a5fc9779f4943` | • Receives stego carrier<br>• Proves World ID & Northstar role<br>• Unseals shares & decrypts payload |
| **Charlie** | Reviewer 1 (VP Eng) | `0x90F79bf6EB2c4f870365E785982E1f101E93b906` | `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6` | • Designated policy reviewer<br>• Signs onchain approval transaction |
| **David** | Reviewer 2 (Core Arch) | `0x35B33Ae737809aa6B03fe4124B760E14e5d996a0` | `0x47e179ec346cb89e5ff473e4a61a7349144452fdd4e2401425e1715f072702f8` | • Designated policy reviewer<br>• Signs onchain approval transaction |
| **Eve** | Reviewer 3 (CCO) | `0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc` | `0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba` | • Designated policy reviewer<br>• Alternate quorum reviewer |

---

## 2. Infrastructure & Service Keys

| Service | Address / Port | Role | Public Identity |
| :--- | :--- | :--- | :--- |
| **Anvil Deployer** | `0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266` | Contract deployer | Deploys `VeilPolicyRegistry.sol` |
| **Northstar Org Authority** | `0x71C8A33118A95240cBE3c52A2D4899c750F69F82` | Identity Authority | Signs Northstar Payments verifiable credentials |
| **Guardian Alpha** | `http://127.0.0.1:8791` | Key Share Custodian 1 | Public Key: `59795dc74c42337580fc1f31f99c2d159a72dfc4edeb8d867ba602518e95df4a` |
| **Guardian Beta** | `http://127.0.0.1:8792` | Key Share Custodian 2 | Public Key: `ee38240f5a7d65b758da4a19c67bc2462b467ec8eb950cdba59ec47df6070a6c` |
| **Guardian Gamma** | `http://127.0.0.1:8793` | Key Share Custodian 3 | Public Key: `da626245d89852c0a969f6bb1a0d810f3408ecbbcf8bc103ea3adcc313e6015c` |

---

## 3. MetaMask / Web3 Wallet Setup

If you prefer to operate the demo using MetaMask, follow these steps:

### Step 1: Add the Local Anvil Network to MetaMask
- **Network Name:** `Local Anvil Testnet`
- **RPC URL:** `http://127.0.0.1:8545`
- **Chain ID:** `31337`
- **Currency Symbol:** `ETH`

### Step 2: Import the 5 Accounts
In MetaMask, click **Account Selector → Add account or hardware wallet → Import account**, select **Private key**, and paste each key:
1. **Alice:** `0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d`
2. **Bob:** `0x5de4111afa1a4b94908f83103eb2f954b09a470d4c628a215a5a5fc9779f4943`
3. **Charlie:** `0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6`
4. **David:** `0x47e179ec346cb89e5ff473e4a61a7349144452fdd4e2401425e1715f072702f8`
5. **Eve:** `0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba`

Each account starts with **10,000 test ETH** pre-funded by Anvil.

---

## 4. Cryptographic Authentication: SIWE (EIP-191)

VEIL implements **Sign-In with Ethereum** for session security:

1. When a participant signs in, the client requests a cryptographically random challenge from the API (`POST /api/v1/auth/challenge`).
2. The user signs an EIP-191 personal sign message:
   ```text
   Sign in to VEIL Protocol
   Address: 0x...
   Nonce: <random-hex-nonce>
   Timestamp: 2026-11-06T13:15:00.000Z
   ```
3. The server verifies the ECDSA signature with `recoverAddress` (`POST /api/v1/auth/verify`).
4. The authenticated session token is bound to that exact Ethereum address. The user's role, permissions, and available dashboard panels automatically adapt to their verified onchain identity.
