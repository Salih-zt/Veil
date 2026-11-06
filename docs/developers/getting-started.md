# Developer Getting Started Guide

`@veil-protocol/sdk` is the official client library for building on the VEIL Programmable Secret Capsule protocol.

---

## Installation

```bash
npm install @veil-protocol/sdk viem @noble/ciphers @noble/curves @noble/hashes
```

---

## 1. Initializing the Client

```typescript
import { VeilClient } from '@veil-protocol/sdk'
import { privateKeyToAccount } from 'viem/accounts'

const client = new VeilClient({
  rpcUrl: 'http://127.0.0.1:8545',
  registryAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  guardians: [
    'http://127.0.0.1:8791',
    'http://127.0.0.1:8792',
    'http://127.0.0.1:8793',
  ],
})
```

---

## 2. Creating an Encrypted Capsule (Alice)

```typescript
// Create an encrypted capsule with a 2-hour timelock and 2-of-2 reviewer approval
const { capsuleId, carrierText, descriptor } = await client.capsules.create({
  plaintext: Buffer.from('CONFIDENTIAL VULNERABILITY ADVISORY'),
  timelockSeconds: 7200,
  threshold: 2,
  reviewers: [
    '0xa0Ee7A142d267C1f36714E4a8F75612F20a79720',
    '0x1e2c4753ba16aD45aE7225Feb819CA7958F52fed'
  ],
  requireWorldId: true,
  requiredOrg: {
    orgId: 'paycore',
    role: 'Security Lead'
  }
})

console.log('Capsule ID:', capsuleId)
console.log('Carrier Text:\n', carrierText)
```

---

## 3. Inspecting Capsule Status (Bob)

```typescript
// Decode carrier text and query onchain policy status
const status = await client.capsules.inspect(carrierText)

console.log('Capsule Status:', status.state) // 'LOCKED' | 'RELEASE_READY' | 'EXPIRED'
console.log('Approvals:', `${status.approvalCount} / ${status.thresholdRequired}`)
console.log('Ready for Release:', status.readyForRelease)
```

---

## 4. Releasing and Decrypting (Bob)

```typescript
if (status.readyForRelease) {
  const plaintext = await client.capsules.decrypt(carrierText, {
    recipientPrivateKey: bobPrivateKey,
    worldProof: bobWorldIdProof,
    orgCredential: bobPayCoreCredential,
  })

  console.log('Decrypted Secret:', plaintext.toString('utf8'))
}
```
