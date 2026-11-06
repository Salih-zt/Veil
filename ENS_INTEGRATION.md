# VEIL — Ethereum Name Service (ENS) Integration

> **Document:** `ENS_INTEGRATION.md`  
> **Repository:** `https://github.com/Salih-zt/Veil.git`  
> **Official Documentation:** https://docs.ens.domains/  
> **Date:** 2026-11-06  

---

## 1. Overview

VEIL integrates the **Ethereum Name Service (ENS)** to provide verifiable cryptographic identity attribution. Rather than relying on arbitrary usernames or easily spoofed form fields, VEIL enforces **bidirectional forward and reverse verification** to prove wallet ownership of an active ENS domain.

---

## 2. Bidirectional Verification Protocol

A claimed ENS identity is only recognized as valid if both of the following cryptographic invariants hold:

```
┌────────────────────────────────────────────────────────────────────────┐
│                   BIDIRECTIONAL ENS VERIFICATION                       │
├───────────────────────────────────┬────────────────────────────────────┤
│ FORWARD RESOLUTION                │ REVERSE RESOLUTION                 │
│                                   │                                    │
│ publicClient.getEnsAddress(name)  │ publicClient.getEnsName(address)   │
│                                   │                                    │
│ Result: 0x3C44...93BC             │ Result: bob.veil.eth               │
├───────────────────────────────────┴────────────────────────────────────┤
│                       VERIFICATION ASSERTION                           │
│ forward(name) === address  AND  reverse(address) === normalize(name)   │
└────────────────────────────────────────────────────────────────────────┘
```

1. **Forward Resolution**: Queries the ENS Registry and Resolver to resolve `name` (e.g. `alice.veil.eth`) to an address.
2. **Reverse Resolution**: Queries the `addr.reverse` node onchain to resolve `address` back to its primary ENS name.
3. **Equivalence Check**:
   - If `forward(name) !== address`: Rejects with `FORWARD_RESOLUTION_MISMATCH`.
   - If `reverse(address) !== name`: Rejects with `REVERSE_RESOLUTION_MISMATCH`.
   - Only when both match is `ens_verified = 1` granted.

---

## 3. Enforcement During Capsule Decryption

When a capsule policy configures `requireEns = 1`:
- The recipient MUST present an authenticated wallet whose bidirectional ENS record is validated.
- The ENS name is recorded on the **Verifiable Disclosure Receipt**.
- If a user attempts to decrypt without a valid matching ENS name, guardians and smart contracts refuse share delivery with:
  ```json
  {
    "error": "ENS_VERIFICATION_REQUIRED",
    "message": "Capsule policy requires recipient to possess a verified primary ENS name"
  }
  ```

---

## 4. Local Testnet & Anvil Fallback

On local Anvil networks (`Chain ID 31337`) where Ethereum Mainnet ENS contracts are not deployed locally, VEIL uses `packages/crypto/identity/ens-resolver.mjs` with an in-memory registry:
- `alice.veil.eth` $\iff$ `0x70997970c51812dc3a010c7d01b50e0d17dc79c8`
- `bob.veil.eth` $\iff$ `0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc`
- `charlie.veil.eth` $\iff$ `0x90f79bf6eb2c4f870365e785982e1f101e93b906`
- `david.veil.eth` $\iff$ `0x35b33ae737809aa6b03fe4124b760e14e5d996a0`
- `eve.veil.eth` $\iff$ `0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc`
- Custom user-registered names: `registerLocalEnsName(name, address)`.
