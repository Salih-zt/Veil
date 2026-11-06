# VEIL — Flexible M-of-N Approval Policy

> **Document:** `APPROVAL_POLICY.md`  
> **Repository:** `https://github.com/Salih-zt/Veil.git`  
> **Date:** 2026-11-06  

---

## 1. Overview

VEIL implements a **dynamic $M$-of-$N$ approval governance engine**. Unlike rigid multi-signature systems or hardcoded thresholds, the capsule creator can configure **any valid threshold** ($1 \le M \le N$) from the designated pool of eligible room approvers.

Examples of supported policies:
- $1 \text{ of } 3$ (Emergency fast-track)
- $2 \text{ of } 3$ (Standard dual-custody)
- $3 \text{ of } 3$ (Unanimous executive consent)
- $3 \text{ of } 4$ (Three-quarters consensus)
- $4 \text{ of } 5$ (Robust high-security threshold)
- $5 \text{ of } 5$ (Full multi-organization agreement)

---

## 2. Onchain Smart Contract Binding

The approval policy is immutably committed onchain inside `VeilPolicyRegistry.sol` during capsule creation:

```solidity
function createCapsule(
    bytes32 capsuleId,
    bytes32 ciphertextHash,
    bytes32 policyHash,
    uint64 unlockTimestamp,
    uint64 expiryTimestamp,
    uint8 threshold,
    address[] calldata reviewers
) external;
```

### Invariants Enforced by Smart Contract:
1. $M \ge 1$ and $M \le N$ (`InvalidThreshold(threshold, reviewers.length)`).
2. No duplicate reviewers permitted (`DuplicateReviewer(reviewer)`).
3. Immutable after creation: Neither creator nor owner can alter the threshold or swap reviewers post-creation.
4. Calling `approveRelease(capsuleId)` requires the caller to be an authorized reviewer (`UnauthorizedReviewer`).
5. Duplicate votes are strictly blocked (`AlreadyApproved`).

---

## 3. Dynamic Quorum Lifecycle & Achievability

Every decryption release request follows a strict state machine:

```
[No Request] 
      │
      ▼
 [Requested] ──► [Awaiting Approvals]
                       │
       ┌───────────────┴───────────────┐
       ▼                               ▼
[Quorum Reached]                [Impossible Quorum]
(approvals >= M)             (N - rejections < M)
       │                               │
       ▼                               ▼
[Release Authorized]              [Rejected]
```

### Quorum Math:
- Total eligible approvers: $N$
- Required threshold: $M$
- Approvals received: $A$
- Rejections recorded: $R$
- Remaining possible approvals: $P = N - (A + R)$
- **Quorum Achieved:** $A \ge M$
- **Quorum Impossible:** $(A + P) < M \iff (N - R) < M$. If this occurs, the request transitions immediately to `rejected`.
