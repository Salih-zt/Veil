# VEIL — World ID 4.0 Integration Specification

> **Document:** `WORLD_ID_INTEGRATION.md`  
> **Repository:** `https://github.com/Salih-zt/Veil.git`  
> **Official Documentation:** https://docs.world.org/  
> **Date:** 2026-11-06  

---

## 1. Overview

VEIL integrates **World ID 4.0** to verify proof-of-unique-humanity without compromising recipient privacy. This prevents AI bot attacks, Sybil key share harvesting, and credential replay.

---

## 2. Cryptographic Signal Binding

To prevent man-in-the-middle attacks where an adversary intercepts a valid World ID proof and attaches their own recipient key, the World ID signal strictly binds:

$$\text{signal} = \text{0x} \,\|\, \text{recipientAddress} \,\|\, \text{recipientEphemeralPubKey}$$

The signal hash is computed according to the BN254 scalar field constraint required by World ID's Semaphore circuits:

$$\text{signalHash} = \text{keccak256}(\text{signal}) \gg 8$$

```javascript
import { keccak256, hexToBytes } from 'viem'

export function hashSignal(signal) {
  const input = hexToBytes(signal.startsWith('0x') ? signal : `0x${signal}`)
  const hash = BigInt(keccak256(input)) >> 8n
  return '0x' + hash.toString(16).padStart(64, '0')
}
```

---

## 3. Action Scoping & Anti-Replay Nullifiers

Every proof is strictly scoped to the specific capsule disclosure via a domain-separated action:

$$\text{action} = \text{veil-capsule-} \,\|\, \text{capsuleId}$$

### Replay Defense:
1. Each proof generates a unique deterministic nullifier for that `(identity, action)` pair.
2. Independent key guardians and the API server check whether the nullifier has already been recorded in the SQLite store.
3. If the nullifier is seen twice for the same capsule, the request is immediately rejected:
   ```json
   {
     "error": "WORLD_ID_REPLAY_ATTEMPT",
     "message": "World ID proof nullifier has already been spent: 0xfe9b..."
   }
   ```

---

## 4. Verification Modes

### A. Production Cloud Verification (Official API)
When `WORLD_ID_APP_ID` is configured in production:
```text
POST https://developer.worldcoin.org/api/v2/verify/{app_id}
{
  "merkle_root": "0x...",
  "nullifier_hash": "0x...",
  "proof": [...],
  "credential_type": "orb",
  "action": "veil-capsule-0x1234...",
  "signal_hash": "0x..."
}
```

### B. Local Demo Semaphore Groth16 Verifier (Explicit Demo Adapter)
When running offline or in local testing environments where Worldcoin production orbs are not accessible, VEIL provides an **explicitly labeled demo adapter**:
- Label: `"Local Demo Semaphore Groth16 Verifier (Explicit Demo Adapter)"`
- Validates BN254 signal hash binding.
- Validates action matching.
- Enforces strict nullifier tracking and anti-replay defense.
- Never falsely masquerades as live production verification.
