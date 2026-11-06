# Local Development & Testing Guide

This guide covers running a complete end-to-end VEIL protocol environment on your local development machine.

---

## Prerequisites

1. **Node.js**: v22.0.0 or higher.
2. **Foundry**: `forge` and `anvil` installed.

---

## 1. Setup Local EVM Node (Anvil)

Start an Anvil local testnet node:

```bash
anvil --port 8545
```

---

## 2. Deploy Smart Contract

Deploy `VeilPolicyRegistry.sol` to your local Anvil node:

```bash
cd contracts
forge script script/DeployVeilPolicyRegistry.s.sol:DeployVeilPolicyRegistry --rpc-url http://127.0.0.1:8545 --broadcast
```

Note the deployed contract address (typically `0x5FbDB2315678afecb367f032d93F642f64180aa3`).

---

## 3. Start Guardian Cluster

In a separate terminal, launch the 3 threshold guardian nodes:

```bash
node scripts/start-guardians.mjs
```

This starts:
- Guardian Alpha on `http://127.0.0.1:8791`
- Guardian Beta on `http://127.0.0.1:8792`
- Guardian Gamma on `http://127.0.0.1:8793`

---

## 4. Start REST API Server

In a third terminal, start the API server:

```bash
node scripts/start-api.mjs
```

The API will listen on `http://127.0.0.1:8088`.

---

## 5. Start Web Dashboard

In a fourth terminal, start the web interface:

```bash
cd apps/web
npm run dev
```

Visit `http://localhost:3000` to interact with the full cybersecurity dashboard.

---

## 6. Run the Test Suite

Run all verification tests:

```bash
node scripts/test-all.mjs
```
