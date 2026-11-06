// VEIL Capsule Lifecycle & State Machine Module
//
// Defines formal states, validated transitions, and factual status derivation.
// Invariants:
//   - Detection must NOT imply authorization.
//   - Authorization must NOT imply release eligibility (time/quorum).
//   - Frontend status is NEVER authoritative; actual status derives from verifiable onchain and cryptographic facts.

export const CAPSULE_STATES = Object.freeze({
  DRAFT: 'DRAFT',                         // Content & policy specified in client
  ENCRYPTED: 'ENCRYPTED',                 // DEK generated, shares split & sealed, ciphertext encrypted
  REGISTERED: 'REGISTERED',               // Shares deposited with guardians & registered onchain
  SHARED: 'SHARED',                       // Encoded into carrier text and transmitted
  DETECTED: 'DETECTED',                   // Carrier text decoded and descriptor verified
  LOCKED: 'LOCKED',                       // Unlock conditions (deadline/quorum) not yet satisfied
  RELEASE_ELIGIBLE: 'RELEASE_ELIGIBLE',   // Onchain conditions met (time, quorum, unexpired, unrevoked)
  AUTHORIZED: 'AUTHORIZED',               // Recipient address & identity/org credentials verified
  SHARES_DELIVERED: 'SHARES_DELIVERED',   // Threshold sealed shares delivered by guardians
  DECRYPTED: 'DECRYPTED',                 // DEK reconstructed and plaintext authenticated locally
  EXPIRED: 'EXPIRED',                     // Passed expiry timestamp
  REVOKED: 'REVOKED',                     // Revoked by creator onchain
})

export const VALID_TRANSITIONS = Object.freeze({
  [CAPSULE_STATES.DRAFT]: [CAPSULE_STATES.ENCRYPTED],
  [CAPSULE_STATES.ENCRYPTED]: [CAPSULE_STATES.REGISTERED],
  [CAPSULE_STATES.REGISTERED]: [CAPSULE_STATES.SHARED, CAPSULE_STATES.REVOKED],
  [CAPSULE_STATES.SHARED]: [CAPSULE_STATES.DETECTED, CAPSULE_STATES.REVOKED],
  [CAPSULE_STATES.DETECTED]: [
    CAPSULE_STATES.LOCKED,
    CAPSULE_STATES.RELEASE_ELIGIBLE,
    CAPSULE_STATES.EXPIRED,
    CAPSULE_STATES.REVOKED,
  ],
  [CAPSULE_STATES.LOCKED]: [
    CAPSULE_STATES.RELEASE_ELIGIBLE,
    CAPSULE_STATES.EXPIRED,
    CAPSULE_STATES.REVOKED,
  ],
  [CAPSULE_STATES.RELEASE_ELIGIBLE]: [
    CAPSULE_STATES.AUTHORIZED,
    CAPSULE_STATES.EXPIRED,
    CAPSULE_STATES.REVOKED,
  ],
  [CAPSULE_STATES.AUTHORIZED]: [
    CAPSULE_STATES.SHARES_DELIVERED,
    CAPSULE_STATES.EXPIRED,
    CAPSULE_STATES.REVOKED,
  ],
  [CAPSULE_STATES.SHARES_DELIVERED]: [
    CAPSULE_STATES.DECRYPTED,
    CAPSULE_STATES.EXPIRED,
    CAPSULE_STATES.REVOKED,
  ],
  [CAPSULE_STATES.DECRYPTED]: [],
  [CAPSULE_STATES.EXPIRED]: [],
  [CAPSULE_STATES.REVOKED]: [],
})

/**
 * Check whether a state transition is logically permitted.
 */
export function canTransition(currentState, nextState) {
  if (!currentState || !nextState) return false
  const allowed = VALID_TRANSITIONS[currentState]
  return Array.isArray(allowed) && allowed.includes(nextState)
}

/**
 * Assert that a state transition is valid, throwing an informative error if not.
 */
export function assertTransition(currentState, nextState) {
  if (!canTransition(currentState, nextState)) {
    throw new Error(
      `Invalid capsule state transition from "${currentState}" to "${nextState}". ` +
      `Permitted transitions: [${(VALID_TRANSITIONS[currentState] || []).join(', ')}]`
    )
  }
}

/**
 * Derives the objective capsule status from verifiable onchain state and cryptographic proofs.
 *
 * @param {object} params
 * @param {object} [params.onchainState] Metadata from VeilPolicyRegistry.getCapsule()
 * @param {boolean} [params.isRecipientAuthorizedOnchain=false] Result of isRecipientAuthorized()
 * @param {boolean} [params.identityProofValid=false] Whether World ID / Org proof verified
 * @param {number} [params.sharesDelivered=0] Count of valid guardian shares collected
 * @param {number} [params.threshold=2] Required threshold shares (k)
 * @param {boolean} [params.decrypted=false] Whether local decryption succeeded
 * @param {number} [params.nowSec] Current unix timestamp in seconds
 * @returns {string} One of CAPSULE_STATES
 */
export function deriveAuthoritativeStatus({
  onchainState = null,
  isRecipientAuthorizedOnchain = false,
  identityProofValid = false,
  sharesDelivered = 0,
  threshold = 2,
  decrypted = false,
  nowSec = Math.floor(Date.now() / 1000),
} = {}) {
  // 1. Decrypted is the terminal success state
  if (decrypted) {
    return CAPSULE_STATES.DECRYPTED
  }

  // 2. Evaluate onchain state if available
  if (onchainState) {
    if (onchainState.revoked) {
      return CAPSULE_STATES.REVOKED
    }

    if (onchainState.expiryTimestamp && Number(onchainState.expiryTimestamp) !== 0) {
      if (nowSec > Number(onchainState.expiryTimestamp)) {
        return CAPSULE_STATES.EXPIRED
      }
    }

    const unlockTime = Number(onchainState.unlockTimestamp || 0)
    const approvals = Number(onchainState.approvalCount || 0)
    const requiredThreshold = Number(onchainState.threshold || threshold)

    const timeSatisfied = nowSec >= unlockTime
    const quorumSatisfied = approvals >= requiredThreshold

    // If core time or quorum conditions not met, capsule is strictly LOCKED
    if (!timeSatisfied || !quorumSatisfied) {
      return CAPSULE_STATES.LOCKED
    }

    // Core onchain release conditions met: check recipient authorization
    if (sharesDelivered >= requiredThreshold) {
      return CAPSULE_STATES.SHARES_DELIVERED
    }

    if (isRecipientAuthorizedOnchain && identityProofValid) {
      return CAPSULE_STATES.AUTHORIZED
    }

    return CAPSULE_STATES.RELEASE_ELIGIBLE
  }

  // 3. Fallback when onchain state has not yet been fetched
  if (sharesDelivered >= threshold) {
    return CAPSULE_STATES.SHARES_DELIVERED
  }

  return CAPSULE_STATES.DETECTED
}
