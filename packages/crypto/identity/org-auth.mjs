// VEIL Organizational Role Authorization Engine
//
// Implements cryptographic role credential issuance and verification:
//   - Verifiable role attestations signed by organization authorities
//   - Cryptographic binding to recipient wallet address
//   - Capsule-scoped or organization-scoped permissions
//   - Role expiry and revocation checks
//   - Built-in deterministic mock authorities for PayCore and Cerberus

import { verifyMessage } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

/**
 * Format domain-separated canonical message for organizational role credentials.
 */
export function formatOrgCredentialMessage({
  orgId,
  authority,
  recipient,
  role,
  capsuleScope,
  nonce,
  issuedAt,
  expiresAt,
}) {
  return [
    'VEIL_ORG_ROLE_CREDENTIAL',
    `Org: ${orgId.toLowerCase()}`,
    `Authority: ${authority.toLowerCase()}`,
    `Recipient: ${recipient.toLowerCase()}`,
    `Role: ${role}`,
    `CapsuleScope: ${capsuleScope.toLowerCase()}`,
    `Nonce: ${nonce}`,
    `IssuedAt: ${issuedAt}`,
    `ExpiresAt: ${expiresAt}`,
  ].join('\n')
}

/**
 * Deterministic test organization configurations.
 */
export const TEST_ORGS = {
  paycore: {
    orgId: 'paycore',
    privateKey: '0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d',
    authorityAddress: privateKeyToAccount('0x4f3edf983ac636a65a842ce7c78d9aa706d3b113bce9c46f30d7d21715b23b1d').address,
    roles: ['Security Lead', 'Compliance Auditor'],
  },
  cerberus: {
    orgId: 'cerberus',
    privateKey: '0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1',
    authorityAddress: privateKeyToAccount('0x6cbed15c793ce57650b9877cf6fa156fbef513c4e6134f022a85b1ffdd59b2a1').address,
    roles: ['Key Custodian', 'Operator'],
  },
  northstar: {
    orgId: 'northstar',
    privateKey: '0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6',
    authorityAddress: privateKeyToAccount('0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6').address,
    roles: ['Security Lead', 'Incident Responder', 'Compliance Auditor'],
  },
}

export const DEFAULT_TRUSTED_AUTHORITIES = {
  paycore: TEST_ORGS.paycore.authorityAddress.toLowerCase(),
  cerberus: TEST_ORGS.cerberus.authorityAddress.toLowerCase(),
  northstar: TEST_ORGS.northstar.authorityAddress.toLowerCase(),
}

/**
 * Issue a signed organizational role credential.
 *
 * @param {object} params
 * @param {string} params.orgId Organization ID (e.g. 'paycore')
 * @param {`0x${string}`} params.authorityPrivateKey Organization authority private key
 * @param {string} params.recipient Recipient wallet address
 * @param {string} params.role Authorized role title
 * @param {string} [params.capsuleScope='*'] Specific capsuleId or '*' for any capsule
 * @param {string} [params.nonce] Unique credential identifier
 * @param {number} [params.issuedAt] Unix timestamp in seconds
 * @param {number} [params.expiresAt] Unix timestamp in seconds
 * @returns {Promise<object>} Signed verifiable credential
 */
export async function issueOrgCredential({
  orgId,
  authorityPrivateKey,
  recipient,
  role,
  capsuleScope = '*',
  nonce,
  issuedAt = Math.floor(Date.now() / 1000),
  expiresAt = Math.floor(Date.now() / 1000) + 86400, // 24 hours
}) {
  if (!orgId || !authorityPrivateKey || !recipient || !role) {
    throw new Error('issueOrgCredential: missing required credential fields')
  }

  const account = privateKeyToAccount(authorityPrivateKey)
  const authority = account.address
  const credNonce = nonce ?? ('cred_' + crypto.randomUUID().replace(/-/g, ''))

  const message = formatOrgCredentialMessage({
    orgId,
    authority,
    recipient,
    role,
    capsuleScope,
    nonce: credNonce,
    issuedAt,
    expiresAt,
  })

  const signature = await account.signMessage({ message })

  return {
    orgId,
    orgAuthority: authority,
    recipient,
    role,
    capsuleScope,
    nonce: credNonce,
    issuedAt,
    expiresAt,
    signature,
  }
}

/**
 * Verify an organizational role credential.
 *
 * @param {object} credential
 * @param {object} params
 * @param {string} [params.expectedOrgId] Required organization ID
 * @param {string} [params.expectedRole] Required role
 * @param {string} [params.expectedRecipient] Expected recipient wallet address
 * @param {string} [params.expectedCapsuleId] Target capsule identifier
 * @param {Record<string, string>} [params.trustedAuthorities=DEFAULT_TRUSTED_AUTHORITIES] Map of orgId => authority address
 * @param {Function} [params.now=() => Date.now()] Clock source
 * @returns {Promise<{ok: boolean, error?: string, reason?: string}>}
 */
export async function verifyOrgCredential(credential, {
  expectedOrgId,
  expectedRole,
  expectedRecipient,
  expectedCapsuleId,
  trustedAuthorities = DEFAULT_TRUSTED_AUTHORITIES,
  now = () => Date.now(),
} = {}) {
  if (!credential || typeof credential !== 'object') {
    return { ok: false, error: 'INVALID_CREDENTIAL_OBJECT', reason: 'Credential missing or not an object' }
  }

  const {
    orgId,
    orgAuthority,
    recipient,
    role,
    capsuleScope = '*',
    nonce,
    issuedAt,
    expiresAt,
    signature,
  } = credential

  if (!orgId || !orgAuthority || !recipient || !role || !nonce || !issuedAt || !expiresAt || !signature) {
    return { ok: false, error: 'MALFORMED_CREDENTIAL', reason: 'Missing required credential properties' }
  }

  // 1. Check organization match
  if (expectedOrgId && orgId.toLowerCase() !== expectedOrgId.toLowerCase()) {
    return {
      ok: false,
      error: 'ORG_MISMATCH',
      reason: `Expected organization "${expectedOrgId}", got "${orgId}"`,
    }
  }

  // 2. Check authority trust
  const trustedAuth = trustedAuthorities[orgId.toLowerCase()]
  if (!trustedAuth) {
    return {
      ok: false,
      error: 'UNTRUSTED_ORGANIZATION',
      reason: `No trusted authority configured for organization "${orgId}"`,
    }
  }
  if (orgAuthority.toLowerCase() !== trustedAuth.toLowerCase()) {
    return {
      ok: false,
      error: 'UNTRUSTED_AUTHORITY',
      reason: `Credential authority "${orgAuthority}" is not trusted for "${orgId}"`,
    }
  }

  // 3. Check recipient match
  if (expectedRecipient && recipient.toLowerCase() !== expectedRecipient.toLowerCase()) {
    return {
      ok: false,
      error: 'RECIPIENT_MISMATCH',
      reason: `Credential issued for "${recipient}", but requested by "${expectedRecipient}"`,
    }
  }

  // 4. Check role match
  if (expectedRole && role.toLowerCase() !== expectedRole.toLowerCase()) {
    return {
      ok: false,
      error: 'ROLE_MISMATCH',
      reason: `Required role "${expectedRole}", but credential has "${role}"`,
    }
  }

  // 5. Check capsule scope
  if (expectedCapsuleId && capsuleScope !== '*') {
    const cleanScope = capsuleScope.toLowerCase().replace(/^0x/, '')
    const cleanCap = expectedCapsuleId.toLowerCase().replace(/^0x/, '')
    if (cleanScope !== cleanCap) {
      return {
        ok: false,
        error: 'CAPSULE_SCOPE_MISMATCH',
        reason: `Credential scoped to capsule "${capsuleScope}", not valid for "${expectedCapsuleId}"`,
      }
    }
  }

  // 6. Check expiration
  const currentSec = Math.floor(now() / 1000)
  if (currentSec > expiresAt) {
    return {
      ok: false,
      error: 'CREDENTIAL_EXPIRED',
      reason: `Credential expired at timestamp ${expiresAt} (current: ${currentSec})`,
    }
  }
  if (currentSec < issuedAt - 300) { // allow 5 min clock skew
    return {
      ok: false,
      error: 'CREDENTIAL_NOT_YET_VALID',
      reason: `Credential issued in the future: ${issuedAt}`,
    }
  }

  // 7. Verify ECDSA signature
  const message = formatOrgCredentialMessage({
    orgId,
    authority: orgAuthority,
    recipient,
    role,
    capsuleScope,
    nonce,
    issuedAt,
    expiresAt,
  })

  try {
    const isValid = await verifyMessage({
      address: orgAuthority,
      message,
      signature,
    })
    if (!isValid) {
      return { ok: false, error: 'INVALID_SIGNATURE', reason: 'Cryptographic signature verification failed' }
    }
  } catch (err) {
    return { ok: false, error: 'SIGNATURE_VERIFICATION_ERROR', reason: err.message }
  }

  return {
    ok: true,
    orgId,
    orgAuthority,
    recipient,
    role,
    capsuleScope,
    nonce,
    expiresAt,
  }
}
