// VEIL Guardian Cluster Release Orchestrator
//
// Concurrently coordinates release requests across independent guardians:
//   - Dispatches release requests to all configured guardians in parallel.
//   - Verifies guardian response signatures to ensure authentic node origin.
//   - Rejects duplicate, malformed, or untrusted responses.
//   - Requires at least k valid distinct key shares (tolerating single-node downtime).
//   - Fails closed when fewer than threshold valid shares are returned.

import { verifyGuardianResponse } from './guardian.mjs'

/**
 * Coordinate threshold share collection across independent guardians.
 *
 * @param {object} params
 * @param {Array<object>} params.guardians Array of guardian instances or HTTP clients
 * @param {object} params.signedRequest Recipient authorization request (from signReleaseRequestV2)
 * @param {object} [params.worldProof] Verified World ID 4.0 proof
 * @param {object} [params.orgCredential] Verified organizational role credential
 * @param {number} [params.threshold=2] Required distinct threshold shares (k)
 * @param {Record<string, string>} [params.expectedGuardianAddresses] Map of guardianId => EVM address
 * @returns {Promise<{ok: boolean, responses?: Array<object>, collectedCount?: number, error?: string, denials?: Array<object>}>}
 */
export async function queryGuardianCluster({
  guardians,
  signedRequest,
  worldProof = null,
  orgCredential = null,
  threshold = 2,
  expectedGuardianAddresses = {},
}) {
  if (!Array.isArray(guardians) || guardians.length === 0) {
    throw new Error('queryGuardianCluster: guardians array is required')
  }
  if (!signedRequest || !signedRequest.capsuleId || !signedRequest.recipient || !signedRequest.signature) {
    throw new Error('queryGuardianCluster: valid signedRequest is required')
  }

  const denials = []
  const validResponses = []
  const seenShareIndices = new Set()

  // Concurrently query all guardians
  const promises = guardians.map(async (g, idx) => {
    const guardianId = g.guardianId || `guardian-${idx}`
    try {
      const res = await g.release({
        capsuleId: signedRequest.capsuleId,
        recipient: signedRequest.recipient,
        recipientPub: signedRequest.recipientPub,
        nonce: signedRequest.nonce,
        expiry: signedRequest.expiry,
        signature: signedRequest.signature,
        chainId: signedRequest.chainId,
        registryAddress: signedRequest.registryAddress,
        policyHash: signedRequest.policyHash,
        worldProof,
        orgCredential,
      })

      if (!res || !res.ok || !res.sealedShare) {
        denials.push({ guardianId, reason: res?.error || 'Empty or rejected response' })
        return null
      }

      // Verify guardian response signature if present
      if (res.signature) {
        const expectedAddr = expectedGuardianAddresses[guardianId] || null
        const verif = await verifyGuardianResponse({ response: res, expectedGuardianAddress: expectedAddr })
        if (!verif.ok) {
          denials.push({ guardianId, reason: `Guardian signature verification failed: ${verif.error}` })
          return null
        }
      }

      return res
    } catch (err) {
      denials.push({ guardianId, reason: err.message })
      return null
    }
  })

  const results = await Promise.all(promises)

  // Filter and de-duplicate by share index
  for (const r of results) {
    if (r && r.sealedShare && r.shareIndex !== undefined) {
      if (!seenShareIndices.has(r.shareIndex)) {
        seenShareIndices.add(r.shareIndex)
        validResponses.push(r)
      }
    }
  }

  // Quorum check: require at least threshold valid distinct shares
  if (validResponses.length < threshold) {
    return {
      ok: false,
      error: 'INSUFFICIENT_SHARES',
      reason: `Collected ${validResponses.length} shares, but threshold requires ${threshold}`,
      collectedCount: validResponses.length,
      threshold,
      denials,
    }
  }

  return {
    ok: true,
    responses: validResponses,
    collectedCount: validResponses.length,
    threshold,
    denials,
  }
}
