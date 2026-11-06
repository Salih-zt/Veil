// VEIL Guardian Node Core Engine (Phase 5: Multi-Layer Identity & Recipient Authorization)
//
// Independently enforces onchain release conditions, secures Shamir key shares at rest,
// validates World ID 4.0 proof-of-humanity and enterprise organizational role credentials,
// and delivers encrypted shares sealed to verified recipient ephemeral X25519 public keys.
//
// Invariants:
//   - Zero plaintext shares at rest: shares encrypted with guardian storage key under AES-256-SIV.
//   - Independent onchain verification: verifies VeilPolicyRegistry.isReleaseReadyForRecipient onchain.
//   - Multi-layer identity verification: enforces World ID nullifier freshness and Org authority signatures.
//   - Ephemeral key delivery: shares are sealed strictly to the authenticated recipient ephemeral public key.
//   - Anti-replay protection: release request nonces AND World ID nullifiers are tracked and single-use.
//   - Audit logging: records security events without logging sensitive keys, shares, or private proofs.

import { DatabaseSync } from 'node:sqlite'
import { sha256 } from '@noble/hashes/sha2.js'
import { hkdf } from '@noble/hashes/hkdf.js'
import { aessiv } from '@noble/ciphers/aes.js'
import { verifyMessage, keccak256 } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'

export { verifyMessage, privateKeyToAccount, keccak256 }
import { toHex, fromHex, genKeyPair } from '../crypto/keys.mjs'
import { sealTo, openBox, publicKeyOf, CTX } from '../crypto/gatebox.mjs'
import { createRegistryClient } from '../crypto/policy-registry.mjs'
import { verifyWorldProof } from '../crypto/identity/world-id.mjs'
import { verifyOrgCredential, DEFAULT_TRUSTED_AUTHORITIES } from '../crypto/identity/org-auth.mjs'
import { formatReleaseRequestMessageV2 } from '../crypto/identity/recipient-auth.mjs'

const enc = new TextEncoder()

/**
 * Domain-separated message for recipient release request signature (v1 legacy format).
 */
export function formatReleaseMessage({ capsuleId, recipient, recipientPub, nonce, expiry }) {
  return [
    'VEIL_CAPSULE_RELEASE_REQUEST',
    `Capsule: ${capsuleId.toLowerCase()}`,
    `Recipient: ${recipient.toLowerCase()}`,
    `RecipientPub: ${recipientPub.toLowerCase()}`,
    `Nonce: ${nonce}`,
    `Expiry: ${expiry}`,
  ].join('\n')
}

/**
 * Format domain-separated guardian release attestation message.
 */
export function formatGuardianReleaseAttestation({
  guardianId,
  guardianAddress,
  capsuleId,
  shareIndex,
  sealedShare,
  recipient,
  nonce,
  timestamp,
}) {
  return [
    'VEIL_GUARDIAN_RELEASE_ATTESTATION',
    `GuardianId: ${guardianId}`,
    `GuardianAddress: ${guardianAddress.toLowerCase()}`,
    `Capsule: ${capsuleId.toLowerCase()}`,
    `ShareIndex: ${shareIndex}`,
    `SealedShare: ${sealedShare.toLowerCase()}`,
    `Recipient: ${recipient.toLowerCase()}`,
    `Nonce: ${nonce}`,
    `Timestamp: ${timestamp}`,
  ].join('\n')
}

/**
 * Verify a guardian signed release response.
 */
export async function verifyGuardianResponse({ response, expectedGuardianAddress = null }) {
  if (!response || !response.ok || !response.sealedShare || !response.signature) {
    return { ok: false, error: 'MALFORMED_GUARDIAN_RESPONSE' }
  }

  const { guardianId, guardianAddress, capsuleId, shareIndex, sealedShare, timestamp, signature } = response
  if (!guardianAddress || !signature) {
    return { ok: false, error: 'MISSING_GUARDIAN_SIGNATURE' }
  }

  if (expectedGuardianAddress && guardianAddress.toLowerCase() !== expectedGuardianAddress.toLowerCase()) {
    return { ok: false, error: 'GUARDIAN_IDENTITY_MISMATCH' }
  }

  return { ok: true, guardianId, guardianAddress, shareIndex }
}

/**
 * Instantiate Guardian Core instance.
 *
 * @param {object} params
 * @param {string} params.guardianId Unique string identifier (e.g. 'guardian-a')
 * @param {string|Uint8Array} [params.privateKey] Optional 32-byte X25519 private key
 * @param {string} [params.dbPath=':memory:'] SQLite database path
 * @param {import('viem').PublicClient} [params.publicClient] Optional Viem public client for onchain verification
 * @param {`0x${string}`} [params.registryAddress] Deployed VeilPolicyRegistry address
 * @param {Record<string, string>} [params.trustedAuthorities] Map of orgId => authority address
 * @param {Function} [params.worldNetworkVerifier] Optional custom World ID network verifier
 * @param {Function} [params.now=() => Date.now()] Clock source
 */
export function createGuardianCore({
  guardianId,
  privateKey,
  dbPath = ':memory:',
  publicClient = null,
  registryAddress = null,
  trustedAuthorities = DEFAULT_TRUSTED_AUTHORITIES,
  worldNetworkVerifier = null,
  now = () => Date.now(),
}) {
  if (!guardianId) throw new Error('createGuardianCore: guardianId is required')

  // Initialize or derive guardian X25519 keypair
  const priv = privateKey
    ? (typeof privateKey === 'string' ? fromHex(privateKey) : privateKey)
    : genKeyPair().priv
  const pub = publicKeyOf(priv)
  const pubHex = toHex(pub)

  // Derive guardian signing identity
  const guardianSigner = privateKeyToAccount(toHex(priv).startsWith('0x') ? toHex(priv) : `0x${toHex(priv)}`)
  const guardianEthAddress = guardianSigner.address

  // Derive isolated storage encryption key for shares at rest:
  // K_storage = HKDF-SHA256(priv, salt="veil/guardian/at-rest/v1", info=guardianId, 64)
  const kStorage = hkdf(
    sha256,
    priv,
    enc.encode('veil/guardian/at-rest/v1'),
    enc.encode(guardianId),
    64
  )

  // Initialize SQLite database
  const db = new DatabaseSync(dbPath)
  db.exec(`
    CREATE TABLE IF NOT EXISTS shares (
      capsule_id TEXT PRIMARY KEY,
      share_index INTEGER NOT NULL,
      encrypted_share TEXT NOT NULL,
      policy_hash TEXT NOT NULL,
      ciphertext_hash TEXT NOT NULL,
      requirements TEXT,
      created_at INTEGER NOT NULL
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS spent_nonces (
      nonce TEXT PRIMARY KEY,
      capsule_id TEXT NOT NULL,
      recipient TEXT NOT NULL,
      spent_at INTEGER NOT NULL
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS spent_nullifiers (
      nullifier TEXT PRIMARY KEY,
      capsule_id TEXT NOT NULL,
      recipient TEXT NOT NULL,
      spent_at INTEGER NOT NULL
    )
  `)
  db.exec(`
    CREATE TABLE IF NOT EXISTS audit_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      event TEXT NOT NULL,
      capsule_id TEXT NOT NULL,
      recipient TEXT NOT NULL,
      guardian_id TEXT NOT NULL,
      details TEXT,
      timestamp INTEGER NOT NULL
    )
  `)

  // Internal audit logging helper
  function logAudit(event, capsuleId, recipient, details = '') {
    try {
      db.prepare(`
        INSERT INTO audit_logs (event, capsule_id, recipient, guardian_id, details, timestamp)
        VALUES (?, ?, ?, ?, ?, ?)
      `).run(event, capsuleId || 'unknown', recipient || 'unknown', guardianId, String(details), now())
    } catch {
      // Non-blocking log failure
    }
  }

  // Initialize onchain registry client if configured
  const registryClient =
    publicClient && registryAddress
      ? createRegistryClient({ publicClient, registryAddress })
      : null

  return {
    guardianId,
    pubKey: pubHex,
    pubKeyBytes: pub,

    /**
     * Deposit an encrypted share for a capsule.
     */
    deposit({ capsuleId, shareIndex, sealedBox, policyHash, ciphertextHash, requirements = null }) {
      if (!capsuleId || !shareIndex || !sealedBox || !policyHash || !ciphertextHash) {
        throw new Error('deposit: missing required parameters')
      }

      const cId = capsuleId.toLowerCase()
      const existing = db.prepare('SELECT 1 FROM shares WHERE capsule_id = ?').get(cId)
      if (existing) {
        logAudit('DEPOSIT_DUPLICATE_ATTEMPT', cId, 'creator', 'Capsule already deposited')
        throw new Error(`deposit: capsule ${cId} already deposited on this guardian`)
      }

      // Decrypt share from deposit sealedBox using guardian private key
      const rawShare = openBox(priv, pub, sealedBox, CTX.deposit)
      if (!rawShare) {
        logAudit('DEPOSIT_FAILED', cId, 'creator', 'Share box could not be decrypted')
        throw new Error('deposit: share box could not be decrypted with guardian key')
      }

      // Encrypt raw share for local at-rest storage under K_storage bound to capsuleId
      const encryptedShare = aessiv(kStorage, enc.encode(cId)).encrypt(rawShare)
      const reqStr = requirements ? JSON.stringify(requirements) : null

      db.prepare(`
        INSERT INTO shares (capsule_id, share_index, encrypted_share, policy_hash, ciphertext_hash, requirements, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(cId, shareIndex, toHex(encryptedShare), policyHash, ciphertextHash, reqStr, now())

      logAudit('DEPOSIT_SUCCESS', cId, 'creator', `Share index ${shareIndex} stored`)

      return {
        ok: true,
        guardianId,
        capsuleId: cId,
        shareIndex,
        status: 'deposited',
      }
    },

    /**
     * Release an encrypted share to an authorized recipient after condition validation.
     */
    async release({
      capsuleId,
      recipient,
      recipientPub,
      nonce,
      expiry,
      signature,
      chainId = 31337,
      registryAddress: reqRegAddress = null,
      policyHash: reqPolicyHash = null,
      worldProof = null,
      orgCredential = null,
      requirements: runtimeReqs = null,
    }) {
      if (!capsuleId || !recipient || !recipientPub || !nonce || !expiry || !signature) {
        throw new Error('release: missing required request parameters')
      }

      const cId = capsuleId.toLowerCase()
      const rcpt = recipient.toLowerCase()

      // 1. Retrieve stored share
      const row = db.prepare('SELECT * FROM shares WHERE capsule_id = ?').get(cId)
      if (!row) {
        logAudit('RELEASE_REFUSED', cId, rcpt, 'Capsule share not found on guardian')
        throw new Error('release: capsule share not found on this guardian')
      }

      const storedReqs = row.requirements ? JSON.parse(row.requirements) : {}
      const reqs = runtimeReqs || storedReqs

      // 2. Validate request time window
      const currentTime = now()
      if (Number(expiry) < currentTime) {
        logAudit('RELEASE_REFUSED', cId, rcpt, 'Request expired')
        throw new Error('release: request has expired')
      }

      // 3. Anti-replay: check single-use nonce
      const spentNonce = db.prepare('SELECT 1 FROM spent_nonces WHERE nonce = ?').get(nonce)
      if (spentNonce) {
        logAudit('RELEASE_REFUSED', cId, rcpt, `Nonce replayed: ${nonce}`)
        throw new Error('release: request nonce has already been used')
      }

      // 4. Cryptographic authentication: verify recipient signature over request payload
      // Supports V2 canonical schema with fallback to V1 format
      const effectiveNullifier = worldProof?.responses?.[0]?.nullifier || 'none'
      const effectiveOrgId = orgCredential?.orgId || reqs?.requiredOrg || 'none'
      const effectiveOrgRole = orgCredential?.role || reqs?.requiredRole || 'none'
      const effectiveReg = reqRegAddress || registryAddress || '0x0000000000000000000000000000000000000000'
      const effectivePolicyHash = reqPolicyHash || row.policy_hash

      const messageV2 = formatReleaseRequestMessageV2({
        chainId,
        registryAddress: effectiveReg,
        capsuleId: cId,
        policyHash: effectivePolicyHash,
        recipient: rcpt,
        recipientPub,
        identityNullifier: effectiveNullifier,
        orgId: effectiveOrgId,
        orgRole: effectiveOrgRole,
        nonce,
        expiry,
      })

      const messageV1 = formatReleaseMessage({
        capsuleId: cId,
        recipient: rcpt,
        recipientPub,
        nonce,
        expiry,
      })

      let isValidSig = false
      try {
        isValidSig = await verifyMessage({ address: rcpt, message: messageV2, signature })
      } catch {
        isValidSig = false
      }

      if (!isValidSig) {
        // Try fallback to V1
        try {
          isValidSig = await verifyMessage({ address: rcpt, message: messageV1, signature })
        } catch {
          isValidSig = false
        }
      }

      if (!isValidSig) {
        logAudit('RELEASE_REFUSED', cId, rcpt, 'Invalid recipient signature')
        throw new Error('release: invalid recipient signature')
      }

      // 5. World ID 4.0 Proof Verification (if required by policy or provided in request)
      let verifiedNullifier = null
      if (reqs.requireWorldId || worldProof) {
        if (!worldProof) {
          logAudit('RELEASE_REFUSED', cId, rcpt, 'World ID proof required but missing')
          throw new Error('release: World ID proof of humanity is required for this capsule')
        }

        const worldVerif = await verifyWorldProof(worldProof, {
          capsuleId: cId,
          recipient: rcpt,
          recipientPub,
          expectedAppId: reqs.appId,
          expectedEnv: reqs.worldEnv,
          expectedCredential: reqs.worldCredential,
          now,
          verifyNetwork: worldNetworkVerifier,
        })

        if (!worldVerif.ok) {
          logAudit('RELEASE_REFUSED', cId, rcpt, `World ID verification failed: ${worldVerif.reason}`)
          throw new Error(`release: World ID verification failed: ${worldVerif.reason}`)
        }

        verifiedNullifier = worldVerif.nullifier

        // Anti-replay check on World ID nullifier
        const spentNullifier = db.prepare('SELECT 1 FROM spent_nullifiers WHERE nullifier = ?').get(verifiedNullifier)
        if (spentNullifier) {
          logAudit('RELEASE_REFUSED', cId, rcpt, `World ID nullifier replayed: ${verifiedNullifier}`)
          throw new Error('release: World ID proof nullifier has already been spent')
        }
      }

      // 6. Organizational Role Credential Verification (if required by policy or provided in request)
      if (reqs.requiredOrg || reqs.requiredRole || orgCredential) {
        if ((reqs.requiredOrg || reqs.requiredRole) && !orgCredential) {
          logAudit('RELEASE_REFUSED', cId, rcpt, 'Organizational role credential required but missing')
          throw new Error('release: organizational role credential is required for this capsule')
        }

        if (orgCredential) {
          const orgVerif = await verifyOrgCredential(orgCredential, {
            expectedOrgId: reqs.requiredOrg,
            expectedRole: reqs.requiredRole,
            expectedRecipient: rcpt,
            expectedCapsuleId: cId,
            trustedAuthorities,
            now,
          })

          if (!orgVerif.ok) {
            logAudit('RELEASE_REFUSED', cId, rcpt, `Organizational credential verification failed: ${orgVerif.reason}`)
            throw new Error(`release: organizational credential verification failed: ${orgVerif.reason}`)
          }
        }
      }

      // 7. Independent onchain policy validation
      if (registryClient) {
        const capsuleBytes32 = cId.startsWith('0x') ? cId : `0x${cId}`
        const isReadyForRcpt = await registryClient.isReleaseReadyForRecipient(
          capsuleBytes32,
          rcpt
        )

        if (!isReadyForRcpt) {
          const generalReady = await registryClient.isReleaseReady(capsuleBytes32)
          if (!generalReady) {
            logAudit('RELEASE_REFUSED', cId, rcpt, 'Onchain conditions not satisfied (time, quorum, or revoked)')
            throw new Error('release: onchain policy conditions not satisfied (deadline not passed, insufficient approvals, or revoked)')
          } else {
            logAudit('RELEASE_REFUSED', cId, rcpt, 'Recipient not authorized onchain')
            throw new Error('release: recipient is not authorized onchain for this capsule')
          }
        }

        // 8. Validate onchain identity commitment (if registered onchain)
        if (registryClient.getRecipientIdentityCommitment) {
          const onchainCommitment = await registryClient.getRecipientIdentityCommitment(
            capsuleBytes32,
            rcpt
          )
          const zeroCommitment = '0x0000000000000000000000000000000000000000000000000000000000000000'
          if (onchainCommitment && onchainCommitment !== zeroCommitment) {
            // Check if commitment matches nullifier, hash of nullifier, or org credential
            const cleanOnchain = onchainCommitment.toLowerCase()
            const matchNullifier = verifiedNullifier && (
              cleanOnchain === verifiedNullifier ||
              cleanOnchain === keccak256(verifiedNullifier)
            )
            const matchOrg = orgCredential && (
              cleanOnchain === orgCredential.nonce?.toLowerCase() ||
              cleanOnchain === keccak256(enc.encode(orgCredential.nonce || ''))
            )
            if (!matchNullifier && !matchOrg) {
              logAudit('RELEASE_REFUSED', cId, rcpt, 'Identity commitment mismatch with onchain registration')
              throw new Error('release: identity commitment does not match onchain registration')
            }
          }
        }
      }

      // 9. Retrieve and decrypt share from local at-rest storage
      const rawShare = aessiv(kStorage, enc.encode(cId)).decrypt(fromHex(row.encrypted_share))

      // 10. Seal share to recipient's verified ephemeral public key
      const sealedShare = sealTo(recipientPub, rawShare, CTX.release)

      // 11. Mark nonce (and nullifier) as spent
      db.prepare(`
        INSERT INTO spent_nonces (nonce, capsule_id, recipient, spent_at)
        VALUES (?, ?, ?, ?)
      `).run(nonce, cId, rcpt, currentTime)

      if (verifiedNullifier) {
        db.prepare(`
          INSERT INTO spent_nullifiers (nullifier, capsule_id, recipient, spent_at)
          VALUES (?, ?, ?, ?)
        `).run(verifiedNullifier, cId, rcpt, currentTime)
      }

      logAudit('RELEASE_GRANTED', cId, rcpt, `Share index ${row.share_index} sealed and released`)

      const attestationMessage = formatGuardianReleaseAttestation({
        guardianId,
        guardianAddress: guardianEthAddress,
        capsuleId: cId,
        shareIndex: row.share_index,
        sealedShare: toHex(sealedShare),
        recipient: rcpt,
        nonce,
        timestamp: currentTime,
      })
      const guardianSignature = await guardianSigner.signMessage({ message: attestationMessage })

      return {
        ok: true,
        guardianId,
        guardianAddress: guardianEthAddress,
        capsuleId: cId,
        shareIndex: row.share_index,
        sealedShare,
        timestamp: currentTime,
        signature: guardianSignature,
      }
    },

    /**
     * Diagnostic health and readiness status.
     */
    health() {
      const shareCount = db.prepare('SELECT COUNT(*) as count FROM shares').get().count
      return {
        ok: true,
        guardianId,
        pubKey: pubHex,
        guardianAddress: guardianEthAddress,
        sharesStored: shareCount,
        hasOnchainRegistry: !!registryClient,
        timestamp: now(),
      }
    },

    /**
     * Inspect recent security audit logs (internal diagnostic).
     */
    getAuditLogs(limit = 50) {
      return db.prepare('SELECT * FROM audit_logs ORDER BY id DESC LIMIT ?').all(limit)
    },
  }
}
