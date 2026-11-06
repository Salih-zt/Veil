// VEIL Protocol SDK — Identity & Recipient Verification Adapters

import type { VeilIdentityAdapter } from '../types/index.js'
import { verifyWorldProof } from '../../../crypto/identity/world-id.mjs'
import { verifyOrgCredential, DEFAULT_TRUSTED_AUTHORITIES } from '../../../crypto/identity/org-auth.mjs'

export class DefaultIdentityAdapter implements VeilIdentityAdapter {
  private readonly trustedAuthorities: Record<string, string>

  constructor(trustedAuthorities: Record<string, string> = DEFAULT_TRUSTED_AUTHORITIES) {
    this.trustedAuthorities = trustedAuthorities
  }

  async verifyWorldProof(proof: any, context: { capsuleId: string; recipient: string; recipientPub: string }): Promise<{ ok: boolean; nullifier?: string; reason?: string }> {
    if (!proof) return { ok: false, reason: 'World ID proof missing' }

    const res = await verifyWorldProof(proof, {
      capsuleId: context.capsuleId,
      recipient: context.recipient,
      recipientPub: context.recipientPub,
    })

    return {
      ok: res.ok,
      nullifier: res.nullifier,
      reason: res.reason,
    }
  }

  async verifyOrgCredential(credential: any, context: { capsuleId: string; recipient: string }): Promise<{ ok: boolean; orgId?: string; role?: string; reason?: string }> {
    if (!credential) return { ok: false, reason: 'Organizational credential missing' }

    const res = await verifyOrgCredential(credential, {
      expectedRecipient: context.recipient,
      expectedCapsuleId: context.capsuleId,
      trustedAuthorities: this.trustedAuthorities,
    })

    return {
      ok: res.ok,
      orgId: credential.orgId,
      role: credential.role,
      reason: res.reason,
    }
  }
}
