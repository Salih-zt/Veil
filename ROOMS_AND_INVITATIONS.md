# VEIL — Private Rooms and Invitation Architecture

> **Document:** `ROOMS_AND_INVITATIONS.md`  
> **Repository:** `https://github.com/Salih-zt/Veil.git`  
> **Date:** 2026-11-06  

---

## 1. Overview

Collaborative conditional disclosure requires trusted organizational boundaries. Rather than publishing capsules globally, VEIL organizes confidential communications into **Private Collaborative Rooms**.

---

## 2. Room Data Model

A room defines an isolated operational context with:
- `id`: Unique identifier (`room_<12-byte-hex>`).
- `name`: Human-readable room title.
- `description`: Scope and security classification.
- `organization`: Sponsoring company or project.
- `creator_wallet`: Wallet address of the room creator (granted `owner` role).
- `visibility`: `'private'` (invite-only) or `'restricted'` (domain-restricted).
- `status`: `'active'` or `'archived'`.

---

## 3. Member Roles & Capabilities

| Role | Room Permissions | Capsule Permissions |
| :--- | :--- | :--- |
| **Owner** | Full management, invite members, revoke access, archive room. | Create capsules, eligible approver. |
| **Approver** | View room members, view pending capsules. | Eligible to be selected in $M$-of-$N$ approval quorums. |
| **Recipient** | View room members, receive assigned capsules. | Permitted to submit decryption requests. |
| **Observer** | Read-only visibility into room metadata. | Cannot approve or request decryption. |

---

## 4. Invitation Lifecycle & Single-Use Tokens

```
┌────────────────────────────────────────────────────────────────────────┐
│                        ROOM INVITATION FLOW                            │
├────────────────────┬────────────────────┬──────────────────────────────┤
│ 1. GENERATE TOKEN  │ 2. DISPATCH        │ 3. ONBOARDING & ACCEPTANCE   │
│                    │                    │                              │
│ 192-bit raw token  │ Shareable link or  │ Invitee opens link           │
│ SHA-256 hash stored│ email notification │ Connects wallet (SIWE)       │
│ Single-use expiry  │ Safe link without  │ Verifies World ID & ENS      │
│ (Default: 72h)     │ plaintext secrets  │ Permanently marks "accepted" │
└────────────────────┴────────────────────┴──────────────────────────────┘
```

1. **Token Generation**:
   $$\text{rawToken} = \text{crypto.getRandomValues}(24 \text{ bytes})$$
   $$\text{tokenHash} = \text{toHex}(\text{sha256}(\text{rawToken}))$$
   Only the token hash is stored in the database.
2. **Onboarding Route (`/invite/:token`)**:
   - Displays room name and inviting owner.
   - Requires invitee to authenticate their own wallet via EIP-191.
   - Prompts for World ID humanity verification and ENS resolution.
   - Upon clicking **Accept Invitation**:
     - Status updates to `accepted`.
     - Invitee wallet is added to `room_members` with the assigned role.
     - Token is permanently deactivated against replay attempts.
