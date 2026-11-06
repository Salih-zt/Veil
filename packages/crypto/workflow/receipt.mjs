// VEIL Cryptographic Disclosure Receipt Module
//
// Generates a verifiable disclosure receipt summarizing the disclosure event:
//   - Distinguishes verifiable onchain facts, guardian release attestations, and client-side decryption.
//   - Zero secret exposure: NEVER contains plaintext, DEKs, raw Shamir shares, or private keys.
//   - Provides immutable audit trail for legal, security, and compliance verification.

/**
 * Generate a formal VEIL Disclosure Receipt.
 *
 * @param {object} params
 * @param {string} params.capsuleId Capsule 32-byte hex ID
 * @param {string} params.policyHash Canonical 32-byte policy hash
 * @param {string} params.ciphertextHash SHA-256 hash of ciphertext
 * @param {string} params.recipientAddress Recipient's wallet address
 * @param {object} [params.onchainFacts] Verified onchain state (block, approvals, timestamps)
 * @param {object} [params.identityAttestation] World ID verification proof summary (nullifier, action)
 * @param {object} [params.orgAttestation] Enterprise role credential summary (orgId, role, authority)
 * @param {Array<object>} [params.guardianAttestations=[]] Guardian signed release responses
 * @param {boolean} [params.decryptionSuccess=true] Whether client decryption succeeded
 * @param {number} [params.timestamp=Date.now()] Receipt creation timestamp
 * @returns {object} Formatted disclosure receipt
 */
export function createDisclosureReceipt({
  capsuleId,
  policyHash,
  ciphertextHash,
  recipientAddress,
  onchainFacts = {},
  identityAttestation = null,
  orgAttestation = null,
  guardianAttestations = [],
  decryptionSuccess = true,
  timestamp = Date.now(),
}) {
  if (!capsuleId || !policyHash || !ciphertextHash || !recipientAddress) {
    throw new Error('createDisclosureReceipt: missing required receipt parameters')
  }

  const receiptId = `rcpt_${crypto.randomUUID().replace(/-/g, '')}`

  // Extract sanitized guardian attestation references (no share data)
  const sanitizedGuardians = (guardianAttestations || []).map((g) => ({
    guardianId: g.guardianId || 'unknown',
    guardianAddress: g.guardianAddress || 'unknown',
    shareIndex: g.shareIndex,
    timestamp: g.timestamp || timestamp,
    hasSignature: Boolean(g.signature),
    signaturePreview: g.signature ? `${g.signature.slice(0, 14)}...` : null,
  }))

  return {
    receiptId,
    protocol: 'VEIL_DISCLOSURE_PROTOCOL_V1',
    issuedAt: new Date(timestamp).toISOString(),
    timestamp,

    // 1. Immutable Capsule Identifiers
    capsule: {
      capsuleId: capsuleId.toLowerCase(),
      policyHash: policyHash.toLowerCase(),
      ciphertextHash: ciphertextHash.toLowerCase(),
      recipientAddress: recipientAddress.toLowerCase(),
    },

    // 2. Verifiable Onchain Facts (Smart Contract State)
    onchainVerification: {
      contractVerified: Boolean(onchainFacts.contractAddress),
      contractAddress: onchainFacts.contractAddress || null,
      blockNumber: onchainFacts.blockNumber || 'latest',
      txHash: onchainFacts.txHash || null,
      unlockTimestamp: onchainFacts.unlockTimestamp || 0,
      expiryTimestamp: onchainFacts.expiryTimestamp || 0,
      thresholdRequired: onchainFacts.threshold || 2,
      approvalsRecorded: onchainFacts.approvalCount || 0,
      quorumSatisfied: Boolean(onchainFacts.quorumSatisfied),
      revoked: Boolean(onchainFacts.revoked),
    },

    // 3. Independent Identity Attestations
    identityVerification: {
      worldId: identityAttestation
        ? {
            verified: true,
            nullifier: identityAttestation.nullifier,
            action: identityAttestation.action,
            protocolVersion: '4.0',
          }
        : { verified: false, required: false },
      organizationalRole: orgAttestation
        ? {
            verified: true,
            orgId: orgAttestation.orgId,
            role: orgAttestation.role,
            authorityAddress: orgAttestation.orgAuthority,
          }
        : { verified: false, required: false },
    },

    // 4. Guardian Network Release Attestations
    guardianRelease: {
      thresholdMet: sanitizedGuardians.length >= (onchainFacts.threshold || 2),
      sharesCollected: sanitizedGuardians.length,
      participatingGuardians: sanitizedGuardians,
    },

    // 5. Client Execution Event
    clientExecution: {
      decryptionSuccess,
      decryptedAt: decryptionSuccess ? new Date(timestamp).toISOString() : null,
      clientKeyProtection: 'DEK reconstructed in transient client memory; never sent to server',
    },

    // 6. Security & Audit Disclosure Notice
    auditNotice: [
      'NOTICE: Blockchain approval events and guardian share deliveries confirm eligibility,',
      'but do not independently prove that the client decrypted the plaintext.',
      'Only possession of the unsealed client-side output confirms local readability.',
      'Zero plaintext or key material is recorded within this receipt.',
    ].join(' '),
  }
}
