# Testnet Deployment Guide (Sepolia / Base Sepolia)

This guide covers deploying VEIL to public Ethereum testnets.

---

## 1. Environment Configuration

Create `.env` from `.env.example`:

```bash
cp .env.example .env
```

Configure testnet parameters:

```ini
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/YOUR_INFURA_KEY
CHAIN_ID=11155111
DEPLOYER_PRIVATE_KEY=0xYOUR_TESTNET_PRIVATE_KEY
```

---

## 2. Deploy Smart Contract

Deploy using Foundry:

```bash
cd contracts
forge script script/DeployVeilPolicyRegistry.s.sol:DeployVeilPolicyRegistry \
  --rpc-url $ETHEREUM_RPC_URL \
  --broadcast \
  --verify \
  --etherscan-api-key $ETHERSCAN_API_KEY
```

Export the deployed contract address:
```bash
export VEIL_POLICY_REGISTRY_ADDRESS="0x..."
```

---

## 3. Configure Guardians for Testnet

Update guardian cluster environment to point to the deployed contract on Sepolia:

```ini
VEIL_POLICY_REGISTRY_ADDRESS=0x...
ETHEREUM_RPC_URL=https://sepolia.infura.io/v3/...
CHAIN_ID=11155111
```

Start the guardians with testnet config:

```bash
node scripts/start-guardians.mjs
```

---

## 4. Verification & Health Check

Query the testnet contract via cast:

```bash
cast call $VEIL_POLICY_REGISTRY_ADDRESS "isReleaseReady(bytes32)(bool)" 0x0000000000000000000000000000000000000000000000000000000000000000 --rpc-url $ETHEREUM_RPC_URL
```
