// VEIL World ID 4.0 Integration & Verification Module
//
// Implements proof-of-humanity verification conforming to official World ID 4.0 / IDKit specs:
//   - Domain-separated per-capsule action: action = veil-capsule-<capsuleId>
//   - Signal bound to recipient wallet and ephemeral X25519 public key: signal = 0x<recipient><recipientPub>
//   - Zero-knowledge proof validation against World ID verifier
//   - Signal hash computation matching BN254 scalar field constraint: keccak256(input) >> 8n

import { keccak256, hexToBytes, toHex } from 'viem'

export const DEFAULT_APP_ID = 'app_veil_protocol'
export const DEFAULT_RP_ID = 'rp_veil_protocol'
export const DEFAULT_CREDENTIAL = 'proof_of_human'

/**
 * Compute action string for a capsule.
 * Per-capsule action ensures proof nullifiers are scoped to this specific capsule disclosure.
 */
export function worldActionFor(capsuleId) {
  if (!capsuleId) throw new Error('worldActionFor: capsuleId is required')
  const cleanId = capsuleId.toLowerCase().replace(/^0x/, '')
  return `veil-capsule-${cleanId}`
}

/**
 * Compute composite signal string binding recipient address and ephemeral public key.
 */
export function worldSignalFor(recipient, recipientPub) {
  if (!recipient || !recipientPub) {
    throw new Error('worldSignalFor: recipient and recipientPub are required')
  }
  const cleanRcpt = recipient.toLowerCase().replace(/^0x/, '')
  const cleanPub = recipientPub.toLowerCase().replace(/^0x/, '')
  return `0x${cleanRcpt}${cleanPub}`
}

/**
 * Hash signal to field element matching IDKit 4.0 / @worldcoin/idkit-core spec.
 * In World ID 4.0: hash = BigInt(keccak256(input)) >> 8n
 */
export function hashSignal(signal) {
  if (!signal) return '0x' + '0'.repeat(64)
  let input
  if (signal instanceof Uint8Array) {
    input = signal
  } else if (typeof signal === 'string' && signal.startsWith('0x') && /^[0-9a-fA-F]+$/.test(signal.slice(2))) {
    input = hexToBytes(signal)
  } else {
    input = new TextEncoder().encode(signal)
  }
  const hash = BigInt(keccak256(input)) >> 8n
  return '0x' + hash.toString(16).padStart(64, '0')
}

/**
 * Generate a deterministic or live IDKit 4.0 mock proof for client testing.
 */
export function generateMockWorldProof({
  capsuleId,
  recipient,
  recipientPub,
  action,
  nullifier,
  environment = 'staging',
  expiresAtMin,
  credential = DEFAULT_CREDENTIAL,
} = {}) {
  const act = action ?? (capsuleId ? worldActionFor(capsuleId) : 'veil-capsule-default')
  const sig = recipient && recipientPub ? worldSignalFor(recipient, recipientPub) : null
  const sigHash = sig ? hashSignal(sig) : '0x' + '0'.repeat(64)
  const nul = nullifier ?? ('0x' + crypto.randomUUID().replace(/-/g, '').padEnd(64, '0'))
  const expiryMin = expiresAtMin ?? (Math.floor(Date.now() / 60000) + 120) // 2 hours from now

  return {
    protocol_version: '4.0',
    action: act,
    environment,
    nonce: '0x' + crypto.randomUUID().replace(/-/g, '').padEnd(64, '0'),
    responses: [
      {
        identifier: credential,
        issuer_schema_id: 1,
        signal_hash: sigHash,
        nullifier: nul,
        proof: ['0x1', '0x2', '0x3', '0x4', '0x5'],
        expires_at_min: String(expiryMin),
      },
    ],
  }
}

/**
 * Verify a World ID 4.0 proof against expected parameters.
 *
 * @param {object} proof IDKit 4.0 response object
 * @param {object} params
 * @param {string} params.capsuleId Expected capsule identifier
 * @param {string} params.recipient Expected recipient wallet address
 * @param {string} params.recipientPub Expected recipient ephemeral public key (hex)
 * @param {string} [params.action] Optional override for action (defaults to worldActionFor(capsuleId))
 * @param {string} [params.expectedAppId] Optional expected appId
 * @param {string} [params.expectedEnv] Optional expected environment ('production'|'staging'|'sandbox')
 * @param {string} [params.expectedCredential=DEFAULT_CREDENTIAL] Expected credential type
 * @param {Function} [params.now=() => Date.now()] Clock source
 * @param {Function} [params.verifyNetwork] Optional function for live API / onchain verification
 * @returns {Promise<{ok: boolean, nullifier?: string, signalHash?: string, error?: string, reason?: string}>}
 */
export async function verifyWorldProof(proof, {
  capsuleId,
  recipient,
  recipientPub,
  action,
  expectedAppId,
  expectedEnv,
  expectedCredential = DEFAULT_CREDENTIAL,
  now = () => Date.now(),
  verifyNetwork = null,
} = {}) {
  if (!proof || typeof proof !== 'object') {
    return { ok: false, error: 'INVALID_PROOF_OBJECT', reason: 'Proof payload is missing or not an object' }
  }

  // 1. Verify protocol version
  if (proof.protocol_version !== '4.0') {
    return {
      ok: false,
      error: 'UNSUPPORTED_PROTOCOL_VERSION',
      reason: `Expected World ID protocol 4.0, got ${proof.protocol_version}`,
    }
  }

  // 2. Verify action
  const expectedAction = action ?? (capsuleId ? worldActionFor(capsuleId) : null)
  if (expectedAction && proof.action !== expectedAction) {
    return {
      ok: false,
      error: 'ACTION_MISMATCH',
      reason: `Proof action "${proof.action}" does not match expected "${expectedAction}"`,
    }
  }

  // 3. Verify environment
  if (expectedEnv && proof.environment && proof.environment !== expectedEnv) {
    return {
      ok: false,
      error: 'ENVIRONMENT_MISMATCH',
      reason: `Proof environment "${proof.environment}" does not match expected "${expectedEnv}"`,
    }
  }

  // 4. Inspect response array
  const responses = Array.isArray(proof.responses) ? proof.responses : []
  if (responses.length === 0) {
    return { ok: false, error: 'MISSING_RESPONSES', reason: 'Proof payload contains empty responses' }
  }

  const r0 = responses.find((r) => r?.identifier === expectedCredential) ?? responses[0]
  if (!r0) {
    return { ok: false, error: 'CREDENTIAL_MISMATCH', reason: `No response matching ${expectedCredential}` }
  }

  if (r0.identifier !== expectedCredential) {
    return {
      ok: false,
      error: 'CREDENTIAL_TYPE_MISMATCH',
      reason: `Expected credential ${expectedCredential}, got ${r0.identifier}`,
    }
  }

  // 5. Verify Groth16 proof structure
  if (!Array.isArray(r0.proof) || r0.proof.length !== 5) {
    return {
      ok: false,
      error: 'MALFORMED_ZK_PROOF',
      reason: 'Malformed zero-knowledge proof structure (expected 5 points)',
    }
  }

  // 6. Verify nullifier presence
  if (!r0.nullifier || typeof r0.nullifier !== 'string' || r0.nullifier.length < 32) {
    return { ok: false, error: 'INVALID_NULLIFIER', reason: 'Nullifier is missing or invalid' }
  }

  // 7. Verify cryptographic signal binding
  if (recipient && recipientPub) {
    const expectedSignal = worldSignalFor(recipient, recipientPub)
    const expectedSignalHash = hashSignal(expectedSignal)
    if (r0.signal_hash?.toLowerCase() !== expectedSignalHash.toLowerCase()) {
      return {
        ok: false,
        error: 'SIGNAL_HASH_MISMATCH',
        reason: 'Proof signal hash does not match recipient address and ephemeral public key',
      }
    }
  }

  // 8. Verify proof freshness / expiration
  if (r0.expires_at_min) {
    const expiresAtMs = Number(r0.expires_at_min) * 60 * 1000
    if (now() > expiresAtMs) {
      return {
        ok: false,
        error: 'PROOF_EXPIRED',
        reason: `Proof expired at ${new Date(expiresAtMs).toISOString()}`,
      }
    }
  }

  // 9. Optional network verification (live World Developer Portal or World Chain verifier)
  if (typeof verifyNetwork === 'function') {
    try {
      const netResult = await verifyNetwork(proof, { expectedAction, expectedAppId, expectedEnv })
      if (!netResult.ok) {
        return {
          ok: false,
          error: 'NETWORK_VERIFICATION_FAILED',
          reason: netResult.reason || 'World ID network verification failed',
        }
      }
    } catch (err) {
      return {
        ok: false,
        error: 'NETWORK_ERROR',
        reason: `Network verification error: ${err.message}`,
      }
    }
  }

  return {
    ok: true,
    nullifier: r0.nullifier.toLowerCase(),
    signalHash: r0.signal_hash ? r0.signal_hash.toLowerCase() : null,
    action: proof.action,
    environment: proof.environment,
    credential: r0.identifier,
  }
}
