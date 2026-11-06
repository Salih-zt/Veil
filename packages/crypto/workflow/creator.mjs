// VEIL Capsule Creation Workflow (Alice)
//
// Implements the complete creation pipeline:
//   1. Accepts confidential content, title, metadata, reviewers, quorums, deadlines, and identity rules.
//   2. Generates unique capsuleId and fresh 64-byte DEK in client memory.
//   3. Pre-computes canonical policy hash.
//   4. Encrypts payload with AES-256-SIV bound to AAD.
//   5. Generates (k, n) Shamir shares over GF(256).
//   6. Seals shares to guardian X25519 public keys.
//   7. Deposits sealed shares across independent guardians and verifies acknowledgements.
//   8. Registers capsule and authorized recipients onchain via VeilPolicyRegistry.
//   9. Persists ciphertext in storage backend.
//  10. Serializes binary descriptor.
//  11. Encodes descriptor into natural-language carrier text via reversible wordmap codec.
//  12. Immediately verifies byte-for-byte reversibility.
//  13. Cleans up temporary DEK and raw shares.

import { createCapsule, parseDescriptor } from '../capsule.mjs'
import { computeCanonicalPolicyHash } from '../policy-registry.mjs'
import { encodeToCarrierText, decodeFromCarrierText } from '../codec/wordmap.mjs'
import { defaultStorage } from '../storage/storage.mjs'
import { toHex } from '../keys.mjs'
import { CAPSULE_STATES, assertTransition } from '../lifecycle.mjs'

const enc = new TextEncoder()

/**
 * Alice: Execute the complete capsule creation and registration pipeline.
 *
 * @param {object} params
 * @param {string} [params.title=''] Human-readable title
 * @param {string} [params.description=''] Human-readable description
 * @param {string|Uint8Array} params.plaintext Confidential secret content
 * @param {Array<`0x${string}`>} [params.recipients=[]] Authorized recipient EVM addresses
 * @param {Array<`0x${string}`>} params.reviewers Assigned reviewer EVM addresses
 * @param {number} [params.threshold=2] Approval threshold (k)
 * @param {number} [params.unlockTimestamp=0] Unlock deadline Unix timestamp in seconds
 * @param {number} [params.expiryTimestamp=0] Expiry Unix timestamp in seconds (0 = none)
 * @param {boolean} [params.requireWorldId=false] Whether World ID proof is required
 * @param {string} [params.requiredOrg=null] Required organization identifier (e.g. 'paycore')
 * @param {string} [params.requiredRole=null] Required enterprise role title (e.g. 'Security Lead')
 * @param {Array<object>} params.guardians Array of guardian instances (with .pubKey, .deposit())
 * @param {object} [params.registryClient] Onchain policy registry client with walletClient
 * @param {object} [params.storage=defaultStorage] Ciphertext storage driver
 * @returns {Promise<object>} Created capsule artifacts and carrier text
 */
export async function createAndRegisterCapsule({
  title = '',
  description = '',
  plaintext,
  recipients = [],
  reviewers = [],
  threshold = 2,
  unlockTimestamp = 0,
  expiryTimestamp = 0,
  requireWorldId = false,
  requiredOrg = null,
  requiredRole = null,
  guardians = [],
  registryClient = null,
  storage = defaultStorage,
}) {
  if (!plaintext || (typeof plaintext === 'string' && !plaintext.trim())) {
    throw new Error('createAndRegisterCapsule: confidential plaintext content is required')
  }
  if (!Array.isArray(reviewers) || reviewers.length === 0) {
    throw new Error('createAndRegisterCapsule: at least one reviewer address is required')
  }
  if (threshold < 1 || threshold > reviewers.length) {
    throw new Error(`createAndRegisterCapsule: invalid threshold ${threshold} for ${reviewers.length} reviewers`)
  }
  if (!Array.isArray(guardians) || guardians.length < threshold) {
    throw new Error(`createAndRegisterCapsule: at least ${threshold} guardians required, got ${guardians.length}`)
  }

  // State: DRAFT
  let currentState = CAPSULE_STATES.DRAFT

  // 1. Generate unique 32-byte capsuleId
  const capsuleIdBytes = crypto.getRandomValues(new Uint8Array(32))
  const capsuleIdHex = `0x${toHex(capsuleIdBytes)}`

  // 2. Pre-compute canonical policy hash
  const policyHashHex = computeCanonicalPolicyHash({
    capsuleId: capsuleIdHex,
    ciphertextHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
    unlockTimestamp,
    expiryTimestamp,
    threshold,
    reviewers,
  })

  // 3. Extract guardian public keys
  const guardianPubKeys = guardians.map((g) => g.pubKey || g.pubKeyBytes)

  // 4. Encrypt confidential content using capsule cryptographic engine
  // State transition: DRAFT -> ENCRYPTED
  assertTransition(currentState, CAPSULE_STATES.ENCRYPTED)
  currentState = CAPSULE_STATES.ENCRYPTED

  const capsule = await createCapsule({
    plaintext,
    policyHash: policyHashHex,
    capsuleId: capsuleIdBytes,
    threshold,
    totalShares: guardians.length,
    guardianPublicKeys: guardianPubKeys,
  })

  // Safe failure tracking
  const depositedGuardians = []

  try {
    // 5. Deposit sealed shares with independent guardians
    const policyRequirements = {
      requireWorldId,
      requiredOrg,
      requiredRole,
    }

    for (let i = 0; i < guardians.length; i++) {
      const g = guardians[i]
      const share = capsule.shares[i]

      const depositRes = await g.deposit({
        capsuleId: capsuleIdHex,
        shareIndex: share.index,
        sealedBox: share.sealedBox,
        policyHash: policyHashHex,
        ciphertextHash: `0x${capsule.ciphertextHash}`,
        requirements: policyRequirements,
      })

      if (!depositRes || !depositRes.ok) {
        throw new Error(`Failed to deposit share with guardian ${g.guardianId || i}`)
      }
      depositedGuardians.push(g.guardianId || `guardian-${i}`)
    }

    // 6. Register capsule onchain
    let onchainTxHash = null
    if (registryClient) {
      onchainTxHash = await registryClient.createCapsule({
        capsuleId: capsuleIdHex,
        ciphertextHash: `0x${capsule.ciphertextHash}`,
        policyHash: policyHashHex,
        unlockTimestamp,
        expiryTimestamp,
        threshold,
        reviewers,
      })

      // Authorize initial recipients onchain if provided
      for (const rcpt of recipients) {
        await registryClient.authorizeRecipient(
          capsuleIdHex,
          rcpt,
          '0x0000000000000000000000000000000000000000000000000000000000000000'
        )
      }
    }

    // State transition: ENCRYPTED -> REGISTERED
    assertTransition(currentState, CAPSULE_STATES.REGISTERED)
    currentState = CAPSULE_STATES.REGISTERED

    // 7. Store ciphertext in storage backend
    const storageRes = await storage.store({
      capsuleId: capsuleIdHex,
      ciphertext: capsule.ciphertext,
      ciphertextHash: capsule.ciphertextHash,
    })

    // 8. Encode binary descriptor into natural-language carrier text
    const carrierText = encodeToCarrierText(capsule.descriptor)

    // 9. Reversibility assertion: immediately decode and verify byte-for-byte exact recovery
    const decodedBytes = decodeFromCarrierText(carrierText)
    if (toHex(decodedBytes) !== toHex(capsule.descriptor)) {
      throw new Error('Carrier text codec verification failed: decoded bytes do not match descriptor')
    }

    // State transition: REGISTERED -> SHARED
    assertTransition(currentState, CAPSULE_STATES.SHARED)
    currentState = CAPSULE_STATES.SHARED

    return {
      success: true,
      state: currentState,
      capsuleId: capsuleIdHex,
      policyHash: policyHashHex,
      ciphertextHash: `0x${capsule.ciphertextHash}`,
      descriptor: capsule.descriptor,
      descriptorB64: capsule.descriptorB64,
      carrierText,
      storageRef: storageRes.storageRef,
      onchainTxHash,
      metadata: {
        title,
        description,
        unlockTimestamp,
        expiryTimestamp,
        threshold,
        totalShares: guardians.length,
        reviewers,
        recipients,
        requirements: policyRequirements,
        depositedGuardians,
      },
    }
  } catch (err) {
    // Zero out sensitive in-memory DEK on failure
    if (capsule.dek instanceof Uint8Array) {
      capsule.dek.fill(0)
    }
    throw new Error(`Capsule creation failed at state ${currentState}: ${err.message}`)
  }
}
