// VEIL Protocol SDK — Capsule Management Module

import { aessiv } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { createCapsule, parseDescriptor, serializeDescriptor, toArmored, fromArmored, MAGIC, VERSION, DEK_LENGTH } from '../../../crypto/capsule.mjs'
import { computeCanonicalPolicyHash } from '../../../crypto/policy-registry.mjs'
import { encodeToCarrierText, decodeFromCarrierText, isCarrierText } from '../../../crypto/codec/wordmap.mjs'
import { reconstruct } from '../../../crypto/sss.mjs'
import { genKeyPair, toHex, fromHex } from '../../../crypto/keys.mjs'
import { openBox, publicKeyOf, CTX } from '../../../crypto/gatebox.mjs'
import { formatReleaseRequestMessageV2, signReleaseRequestV2 } from '../../../crypto/identity/recipient-auth.mjs'
import { createDisclosureReceipt } from '../../../crypto/workflow/receipt.mjs'
import type {
  CapsuleCreateInput,
  CapsuleCreateResult,
  CapsuleDetails,
  CapsuleApproveInput,
  CapsuleDecryptInput,
  CapsuleDecryptResult,
  DisclosureReceipt,
  VeilStorageAdapter,
  VeilGuardianAdapter,
  VeilRegistryAdapter,
  VeilWalletAdapter,
} from '../types/index.js'
import {
  CapsuleNotFoundError,
  CapsuleLockedError,
  CapsuleExpiredError,
  CapsuleRevokedError,
  InsufficientApprovalsError,
  RecipientNotAuthorizedError,
  InsufficientGuardianSharesError,
  InvalidGuardianSignatureError,
  CiphertextIntegrityError,
  ShareReconstructionError,
  InvalidParameterError,
} from '../errors/index.js'

const enc = new TextEncoder()
const dec = new TextDecoder()

export class CapsuleManager {
  private readonly storage: VeilStorageAdapter
  private readonly registry: VeilRegistryAdapter
  private readonly guardians: VeilGuardianAdapter[]
  private readonly defaultWallet?: VeilWalletAdapter
  private readonly receiptCache = new Map<string, DisclosureReceipt>()

  constructor(params: {
    storage: VeilStorageAdapter
    registry: VeilRegistryAdapter
    guardians: VeilGuardianAdapter[]
    defaultWallet?: VeilWalletAdapter
  }) {
    this.storage = params.storage
    this.registry = params.registry
    this.guardians = params.guardians
    this.defaultWallet = params.defaultWallet
  }

  /**
   * Create, encrypt, split, deposit, and register a new programmable secret capsule.
   */
  async create(input: CapsuleCreateInput): Promise<CapsuleCreateResult> {
    if (!input || !input.content) {
      throw new InvalidParameterError('content', 'Plaintext secret content is required')
    }
    if (!input.policy) {
      throw new InvalidParameterError('policy', 'Capsule release policy is required')
    }
    if (!input.policy.threshold || input.policy.threshold < 1) {
      throw new InvalidParameterError('policy.threshold', 'Threshold must be at least 1')
    }
    if (!Array.isArray(input.policy.reviewers) || input.policy.reviewers.length === 0) {
      throw new InvalidParameterError('policy.reviewers', 'At least one reviewer address is required')
    }

    const unlockTimestamp = typeof input.policy.unlockAt === 'string'
      ? Math.floor(new Date(input.policy.unlockAt).getTime() / 1000)
      : Math.floor(input.policy.unlockAt)

    const expiryTimestamp = input.policy.expiresAt
      ? (typeof input.policy.expiresAt === 'string'
          ? Math.floor(new Date(input.policy.expiresAt).getTime() / 1000)
          : Math.floor(input.policy.expiresAt))
      : 0

    const targetGuardians = input.guardians && input.guardians.length > 0
      ? (typeof input.guardians[0] === 'string'
          ? this.guardians // fallback or resolve if URLs
          : input.guardians as VeilGuardianAdapter[])
      : this.guardians

    if (targetGuardians.length < input.policy.threshold) {
      throw new InvalidParameterError(
        'guardians',
        `Available guardians (${targetGuardians.length}) is less than policy threshold (${input.policy.threshold})`
      )
    }

    // 1. Generate 32-byte unique capsuleId
    const capsuleIdBytes = crypto.getRandomValues(new Uint8Array(32))
    const capsuleIdHex = `0x${toHex(capsuleIdBytes)}` as `0x${string}`

    // 2. Compute canonical onchain policy hash
    const policyHashHex = computeCanonicalPolicyHash({
      capsuleId: capsuleIdHex,
      ciphertextHash: '0x0000000000000000000000000000000000000000000000000000000000000000',
      unlockTimestamp,
      expiryTimestamp,
      threshold: input.policy.threshold,
      reviewers: input.policy.reviewers as `0x${string}`[],
    })

    // 3. Fetch guardian public keys
    const guardianPubKeys: string[] = []
    for (const g of targetGuardians) {
      const pub = await g.getPublicKey()
      guardianPubKeys.push(pub)
    }

    // 4. Encrypt payload and split DEK into threshold shares
    const capsule = await createCapsule({
      plaintext: input.content,
      policyHash: policyHashHex,
      capsuleId: capsuleIdBytes,
      threshold: input.policy.threshold,
      totalShares: targetGuardians.length,
      guardianPublicKeys: guardianPubKeys,
    })

    const ciphertextHash = `0x${capsule.ciphertextHash}` as `0x${string}`

    try {
      // 5. Deposit individual sealed shares with independent guardians
      const policyRequirements = {
        requireWorldId: Boolean(input.policy.requireWorldId),
        requiredOrg: input.policy.requiredOrg,
        requiredRole: input.policy.requiredRole,
      }

      for (let i = 0; i < targetGuardians.length; i++) {
        const g = targetGuardians[i]
        const share = capsule.shares[i]

        const depRes = await g.depositShare({
          capsuleId: capsuleIdHex,
          shareIndex: share.index,
          sealedBox: share.sealedBox,
          policyHash: policyHashHex,
          ciphertextHash,
          requirements: policyRequirements,
        })

        if (!depRes || !depRes.ok) {
          throw new Error(`Deposit failed on guardian ${g.guardianId}`)
        }
      }

      // 6. Register disclosure policy onchain
      const txHash = await this.registry.createCapsule({
        capsuleId: capsuleIdHex,
        ciphertextHash,
        policyHash: policyHashHex,
        unlockTimestamp,
        expiryTimestamp,
        threshold: input.policy.threshold,
        reviewers: input.policy.reviewers as string[],
      })

      // Authorize initial recipients onchain if provided
      if (input.recipients && Array.isArray(input.recipients)) {
        for (const r of input.recipients) {
          const addr = typeof r === 'string' ? r : r.address
          await this.registry.authorizeRecipient(
            capsuleIdHex,
            addr,
            '0x0000000000000000000000000000000000000000000000000000000000000000'
          )
        }
      }

      // 7. Upload ciphertext to storage adapter
      const storageRef = await this.storage.upload({
        capsuleId: capsuleIdHex,
        ciphertext: capsule.ciphertext,
        ciphertextHash,
      })

      // 8. Encode binary descriptor into natural language cover text
      const carrierText = encodeToCarrierText(capsule.descriptor)

      const descriptor: any = {
        version: VERSION,
        capsuleId: capsuleIdHex,
        policyHash: policyHashHex,
        ciphertextHash,
        threshold: input.policy.threshold,
        totalShares: targetGuardians.length,
        storageType: 0,
        ciphertext: capsule.ciphertext,
        carrierText,
        rawBytes: capsule.descriptor,
        armored: toArmored(capsule.descriptor),
      }

      return {
        capsuleId: capsuleIdHex,
        policyHash: policyHashHex,
        ciphertextHash,
        descriptor,
        storageReference: storageRef,
        transactionHash: txHash,
        carrierText,
        status: 'created',
      }
    } catch (err: any) {
      // Invariant: zero out sensitive DEK memory on failure
      if (capsule.dek instanceof Uint8Array) {
        capsule.dek.fill(0)
      }
      throw err
    }
  }

  /**
   * Inspect onchain capsule state and access requirements.
   */
  async get(capsuleId: string, recipientAddress?: string): Promise<CapsuleDetails> {
    const cId = (capsuleId.startsWith('0x') ? capsuleId : `0x${capsuleId}`) as `0x${string}`
    const cap = await this.registry.getCapsule(cId)

    if (!cap || !cap.exists) {
      throw new CapsuleNotFoundError(cId)
    }

    const reviewers = await this.registry.getReviewers(cId)
    const isReleaseReady = await this.registry.isReleaseReady(cId)
    let isRecipientAuthorized: boolean | undefined = undefined

    if (recipientAddress) {
      isRecipientAuthorized = await this.registry.isReleaseReadyForRecipient(cId, recipientAddress)
    }

    const nowSec = Math.floor(Date.now() / 1000)
    const unlockTimestamp = Number(cap.unlockTimestamp)
    const expiryTimestamp = Number(cap.expiryTimestamp)
    const threshold = Number(cap.threshold)
    const approvalCount = Number(cap.approvalCount)

    return {
      capsuleId: cId,
      creator: cap.creator as `0x${string}`,
      policyHash: cap.policyHash as `0x${string}`,
      ciphertextHash: cap.ciphertextHash as `0x${string}`,
      unlockTimestamp,
      unlockDate: unlockTimestamp ? new Date(unlockTimestamp * 1000).toISOString() : 'Immediate',
      expiryTimestamp,
      expiryDate: expiryTimestamp ? new Date(expiryTimestamp * 1000).toISOString() : 'Never',
      threshold,
      approvalCount,
      reviewers,
      revoked: Boolean(cap.revoked),
      exists: Boolean(cap.exists),
      isReleaseReady,
      isRecipientAuthorized,
      requirements: {
        timeSatisfied: unlockTimestamp === 0 || nowSec >= unlockTimestamp,
        quorumSatisfied: approvalCount >= threshold,
        requireWorldId: false,
      },
    }
  }

  /**
   * Submit reviewer approval transaction onchain.
   */
  async approve(input: CapsuleApproveInput): Promise<`0x${string}`> {
    const cId = input.capsuleId.startsWith('0x') ? input.capsuleId : `0x${input.capsuleId}`
    return this.registry.approveRelease(cId, input.signer || this.defaultWallet)
  }

  /**
   * Request threshold key shares from guardians and decrypt capsule locally.
   */
  async decrypt(input: CapsuleDecryptInput): Promise<CapsuleDecryptResult> {
    // 1. Resolve descriptor bytes
    let descriptorBytes: Uint8Array | null = null

    if (input.carrierText) {
      descriptorBytes = decodeFromCarrierText(input.carrierText)
    } else if (input.descriptor) {
      if (typeof input.descriptor === 'string') {
        if (input.descriptor.includes('-----BEGIN VEIL CAPSULE-----')) {
          descriptorBytes = fromArmored(input.descriptor)
        } else if (isCarrierText(input.descriptor)) {
          descriptorBytes = decodeFromCarrierText(input.descriptor)
        } else {
          descriptorBytes = fromHex(input.descriptor)
        }
      } else {
        descriptorBytes = input.descriptor
      }
    }

    if (!descriptorBytes) {
      throw new InvalidParameterError('descriptor', 'Valid descriptor bytes or carrierText required')
    }

    // 2. Parse descriptor
    const parsed = parseDescriptor(descriptorBytes)
    const capsuleId = `0x${parsed.capsuleId}` as `0x${string}`
    const policyHash = `0x${parsed.policyHash}` as `0x${string}`
    const ciphertextHash = `0x${parsed.ciphertextHash}` as `0x${string}`

    // 3. Resolve ciphertext
    let ciphertext = parsed.ciphertext
    if (!ciphertext) {
      const storageRef = `veil://local/${parsed.ciphertextHash}`
      ciphertext = await this.storage.download({
        storageReference: storageRef,
        expectedCiphertextHash: ciphertextHash,
      })
    }

    // 4. Verify ciphertext SHA-256 integrity
    const computedHash = `0x${toHex(sha256(ciphertext))}`
    if (computedHash.toLowerCase() !== ciphertextHash.toLowerCase()) {
      throw new CiphertextIntegrityError(ciphertextHash, computedHash)
    }

    // 5. Query onchain policy status
    const onchain = await this.get(capsuleId)
    if (onchain.revoked) {
      throw new CapsuleRevokedError(capsuleId)
    }
    const currentSec = input.nowSec ?? Math.floor(Date.now() / 1000)
    if (onchain.expiryTimestamp !== 0 && currentSec > onchain.expiryTimestamp) {
      throw new CapsuleExpiredError(onchain.expiryTimestamp)
    }
    if (currentSec < onchain.unlockTimestamp) {
      throw new CapsuleLockedError(
        `Capsule is locked until ${new Date(onchain.unlockTimestamp * 1000).toISOString()}`
      )
    }
    if (onchain.approvalCount < onchain.threshold) {
      throw new InsufficientApprovalsError(onchain.approvalCount, onchain.threshold)
    }
    if (!onchain.isReleaseReady) {
      throw new CapsuleLockedError('Onchain policy conditions not satisfied')
    }

    // 6. Recipient identity & wallet setup
    const wallet = input.recipient || this.defaultWallet
    if (!wallet) {
      throw new InvalidParameterError('recipient', 'Recipient wallet signer is required to authorize release')
    }
    const recipientAddress = await wallet.getAddress()

    // 7. Ephemeral keypair for share sealing
    const ephKeypair = input.ephemeralPrivateKey
      ? (() => {
          const priv = typeof input.ephemeralPrivateKey === 'string' ? fromHex(input.ephemeralPrivateKey) : input.ephemeralPrivateKey
          return { priv, pub: publicKeyOf(priv) }
        })()
      : genKeyPair()

    const recipientPubHex = toHex(ephKeypair.pub)

    // 8. Sign release request
    const nonce = `nonce_${crypto.randomUUID().replace(/-/g, '')}`
    const expiry = (currentSec + 300) * 1000 // 5 minute TTL

    const signedRequest = await signReleaseRequestV2({
      account: {
        address: recipientAddress,
        signMessage: (m: any) => wallet.signMessage(typeof m === 'string' ? m : m.message),
      },
      registryAddress: this.registry.address,
      capsuleId,
      policyHash,
      recipientPub: recipientPubHex,
      worldProof: input.worldProof,
      orgCredential: input.organizationCredential,
      nonce,
      expiry,
      now: () => currentSec * 1000,
    })

    // 9. Concurrently query guardian cluster
    const guardianResponses: any[] = []
    const seenIndices = new Set<number>()

    const queries = this.guardians.map(async (g) => {
      try {
        const res = await g.requestShare({
          capsuleId,
          recipient: recipientAddress,
          recipientPub: recipientPubHex,
          nonce: signedRequest.nonce,
          expiry: signedRequest.expiry,
          signature: signedRequest.signature,
          registryAddress: this.registry.address,
          policyHash,
          worldProof: input.worldProof,
          orgCredential: input.organizationCredential,
        })
        return res
      } catch {
        return null
      }
    })

    const results = await Promise.all(queries)

    for (const r of results) {
      if (r && r.ok && r.sealedShare && r.shareIndex !== undefined) {
        if (!seenIndices.has(r.shareIndex)) {
          seenIndices.add(r.shareIndex)
          guardianResponses.push(r)
        }
      }
    }

    if (guardianResponses.length < parsed.threshold) {
      const reasons = results.map(r => r?.error).filter(Boolean).join('; ')
      throw new InsufficientGuardianSharesError(
        guardianResponses.length,
        parsed.threshold,
        { reasons }
      )
    }

    // 10. Unseal shares locally using ephemeral private key
    const rawShares: Array<{ index: number; share: Uint8Array }> = []
    for (const resp of guardianResponses) {
      try {
        const unsealed = openBox(ephKeypair.priv, ephKeypair.pub, resp.sealedShare, CTX.release)
        if (unsealed instanceof Uint8Array && unsealed.length > 0) {
          rawShares.push({ index: resp.shareIndex, share: unsealed })
        }
      } catch {
        // Individual unseal failure ignored
      }
    }

    if (rawShares.length < parsed.threshold) {
      throw new ShareReconstructionError(
        `Successfully unsealed ${rawShares.length} shares, but threshold requires ${parsed.threshold}`
      )
    }

    // 11. Reconstruct DEK in transient memory
    let dek: Uint8Array | null = null
    let plaintext: Uint8Array | null = null

    try {
      dek = reconstruct(rawShares.slice(0, parsed.threshold))

      // 12. Decrypt ciphertext under AES-256-SIV with AAD binding
      const cat = (...parts: Uint8Array[]) => {
        const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
        let at = 0
        for (const p of parts) {
          out.set(p, at)
          at += p.length
        }
        return out
      }
      const aad = cat(enc.encode(`veil/v${parsed.version}/aad`), fromHex(parsed.capsuleId), fromHex(parsed.policyHash))
      plaintext = aessiv(dek, aad).decrypt(ciphertext)
    } catch (err: any) {
      throw new ShareReconstructionError(`Cryptographic decryption failed: ${err.message}`)
    } finally {
      // Invariant: Zeroize DEK memory buffer immediately
      if (dek instanceof Uint8Array) {
        dek.fill(0)
      }
    }

    // 13. Generate disclosure receipt
    const receipt = createDisclosureReceipt({
      capsuleId,
      policyHash,
      ciphertextHash,
      recipientAddress,
      onchainFacts: {
        contractAddress: this.registry.address,
        unlockTimestamp: onchain.unlockTimestamp,
        expiryTimestamp: onchain.expiryTimestamp,
        threshold: onchain.threshold,
        approvalCount: onchain.approvalCount,
        quorumSatisfied: onchain.requirements.quorumSatisfied,
        revoked: onchain.revoked,
      },
      identityAttestation: input.worldProof?.responses?.[0]?.nullifier
        ? {
            nullifier: input.worldProof.responses[0].nullifier,
            action: input.worldProof.action,
            verified: true,
          }
        : null,
      orgAttestation: input.organizationCredential?.role
        ? {
            orgId: input.organizationCredential.orgId,
            role: input.organizationCredential.role,
            orgAuthority: input.organizationCredential.orgAuthority,
            verified: true,
          }
        : null,
      guardianAttestations: guardianResponses,
      decryptionSuccess: true,
    }) as any

    this.receiptCache.set(capsuleId.toLowerCase(), receipt)

    return {
      capsuleId,
      plaintext,
      text: dec.decode(plaintext),
      receipt,
    }
  }

  /**
   * Retrieve cached disclosure receipt or construct verification record.
   */
  async getReceipt(capsuleId: string): Promise<DisclosureReceipt> {
    const cId = capsuleId.toLowerCase()
    const cached = this.receiptCache.get(cId)
    if (cached) return cached

    const onchain = await this.get(capsuleId)
    return createDisclosureReceipt({
      capsuleId,
      policyHash: onchain.policyHash,
      ciphertextHash: onchain.ciphertextHash,
      recipientAddress: '0x0000000000000000000000000000000000000000',
      onchainFacts: {
        contractAddress: this.registry.address,
        unlockTimestamp: onchain.unlockTimestamp,
        expiryTimestamp: onchain.expiryTimestamp,
        threshold: onchain.threshold,
        approvalCount: onchain.approvalCount,
        quorumSatisfied: onchain.requirements.quorumSatisfied,
        revoked: onchain.revoked,
      },
      guardianAttestations: [],
      decryptionSuccess: false,
    }) as any
  }
}
