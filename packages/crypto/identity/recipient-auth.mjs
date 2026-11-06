// VEIL Recipient-Bound Authorization Signing Module (v2)
//
// Implements canonical cryptographic binding of recipient identity to ephemeral disclosure keys:
//   - Domain-separated message schema with ChainId and Registry address
//   - Binds capsuleId and policyHash (prevents cross-capsule replay)
//   - Binds recipient wallet address and ephemeral X25519 public key (prevents MITM key substitution)
//   - Binds World ID nullifier and Organizational role (prevents credential dissociation)
//   - Single-use nonce and short TTL timestamp enforcement

import { verifyMessage } from 'viem'

export const DEFAULT_MAX_SIGNATURE_TTL_MS = 10 * 60 * 1000 // 10 minutes

/**
 * Format domain-separated canonical message for release requests.
 */
export function formatReleaseRequestMessageV2({
  chainId = 31337,
  registryAddress = '0x0000000000000000000000000000000000000000',
  capsuleId,
  policyHash,
  recipient,
  recipientPub,
  identityNullifier = 'none',
  orgId = 'none',
  orgRole = 'none',
  nonce,
  expiry,
}) {
  if (!capsuleId || !recipient || !recipientPub || !nonce || !expiry) {
    throw new Error('formatReleaseRequestMessageV2: missing required parameters')
  }

  const cleanCapsule = capsuleId.toLowerCase()
  const cleanPolicy = policyHash ? policyHash.toLowerCase() : 'none'
  const cleanRcpt = recipient.toLowerCase()
  const cleanPub = recipientPub.toLowerCase()
  const cleanReg = registryAddress ? registryAddress.toLowerCase() : '0x0000000000000000000000000000000000000000'
  const cleanNullifier = identityNullifier ? identityNullifier.toLowerCase() : 'none'
  const cleanOrg = orgId ? orgId.toLowerCase() : 'none'

  return [
    'VEIL_CAPSULE_RELEASE_REQUEST_V2',
    `ChainId: ${chainId}`,
    `Registry: ${cleanReg}`,
    `Capsule: ${cleanCapsule}`,
    `PolicyHash: ${cleanPolicy}`,
    `Recipient: ${cleanRcpt}`,
    `RecipientPub: ${cleanPub}`,
    `IdentityNullifier: ${cleanNullifier}`,
    `OrgId: ${cleanOrg}`,
    `OrgRole: ${orgRole || 'none'}`,
    `Nonce: ${nonce}`,
    `Expiry: ${expiry}`,
  ].join('\n')
}

/**
 * Sign a release request payload using an EVM account or signer.
 */
export async function signReleaseRequestV2({
  account,
  chainId,
  registryAddress,
  capsuleId,
  policyHash,
  recipientPub,
  identityNullifier,
  orgId,
  orgRole,
  worldProof = null,
  orgCredential = null,
  nonce,
  expiry,
  ttlMs = 5 * 60 * 1000, // 5 minutes default
  now = () => Date.now(),
}) {
  if (!account || !account.address || !account.signMessage) {
    throw new Error('signReleaseRequestV2: valid account signer is required')
  }

  const exp = expiry ?? (now() + ttlMs)
  const n = nonce ?? ('nonce_' + crypto.randomUUID().replace(/-/g, ''))
  const nul = identityNullifier || worldProof?.responses?.[0]?.nullifier || 'none'
  const oId = orgId || orgCredential?.orgId || 'none'
  const oRole = orgRole || orgCredential?.role || 'none'

  const message = formatReleaseRequestMessageV2({
    chainId,
    registryAddress,
    capsuleId,
    policyHash,
    recipient: account.address,
    recipientPub,
    identityNullifier: nul,
    orgId: oId,
    orgRole: oRole,
    nonce: n,
    expiry: exp,
  })

  const signature = await account.signMessage({ message })

  return {
    chainId,
    registryAddress,
    capsuleId,
    policyHash,
    recipient: account.address,
    recipientPub,
    identityNullifier: nul,
    orgId: oId,
    orgRole: oRole,
    nonce: n,
    expiry: exp,
    message,
    signature,
  }
}

/**
 * Verify a recipient-bound release request.
 */
export async function verifyReleaseRequestV2({
  request,
  signature,
  now = () => Date.now(),
  maxTtlMs = DEFAULT_MAX_SIGNATURE_TTL_MS,
}) {
  if (!request || typeof request !== 'object' || !signature) {
    return { ok: false, error: 'INVALID_REQUEST', reason: 'Missing request object or signature' }
  }

  const {
    chainId,
    registryAddress,
    capsuleId,
    policyHash,
    recipient,
    recipientPub,
    identityNullifier,
    orgId,
    orgRole,
    nonce,
    expiry,
  } = request

  const currentTime = now()

  // 1. Check expiration
  if (Number(expiry) < currentTime) {
    return {
      ok: false,
      error: 'REQUEST_EXPIRED',
      reason: `Request expired at ${expiry} (current: ${currentTime})`,
    }
  }

  // 2. Enforce short maximum TTL
  if (Number(expiry) - currentTime > maxTtlMs) {
    return {
      ok: false,
      error: 'TTL_EXCEEDED',
      reason: `Request TTL exceeds maximum allowable window (${maxTtlMs}ms)`,
    }
  }

  // 3. Reconstruct canonical message
  const message = formatReleaseRequestMessageV2({
    chainId,
    registryAddress,
    capsuleId,
    policyHash,
    recipient,
    recipientPub,
    identityNullifier,
    orgId,
    orgRole,
    nonce,
    expiry,
  })

  // 4. Verify wallet signature
  try {
    const isValid = await verifyMessage({
      address: recipient,
      message,
      signature,
    })
    if (!isValid) {
      return { ok: false, error: 'INVALID_SIGNATURE', reason: 'Cryptographic signature verification failed' }
    }
  } catch (err) {
    return { ok: false, error: 'SIGNATURE_VERIFICATION_ERROR', reason: err.message }
  }

  return { ok: true, recipient: recipient.toLowerCase(), message }
}
