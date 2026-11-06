// VEIL Protocol SDK — Comprehensive Unit & Security Test Suite (Phase 7)

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { VeilClient } from '../../packages/sdk/src/client.ts'
import { MemoryStorageAdapter } from '../../packages/sdk/src/adapters/storage.ts'
import { DirectGuardianAdapter } from '../../packages/sdk/src/adapters/guardian.ts'
import { ViemAccountWalletAdapter } from '../../packages/sdk/src/adapters/wallet.ts'
import {
  CapsuleNotFoundError,
  CapsuleLockedError,
  CapsuleExpiredError,
  CapsuleRevokedError,
  InsufficientApprovalsError,
  InsufficientGuardianSharesError,
  CiphertextIntegrityError,
  ShareReconstructionError,
  InvalidParameterError,
} from '../../packages/sdk/src/errors/index.ts'
import { createGuardianCore, privateKeyToAccount } from '../../packages/guardian/guardian.mjs'
import { generateMockWorldProof } from '../../packages/crypto/identity/world-id.mjs'
import { issueOrgCredential, TEST_ORGS } from '../../packages/crypto/identity/org-auth.mjs'
import { genKeyPair, toHex } from '../../packages/crypto/keys.mjs'

describe('VEIL Protocol SDK (@veil-protocol/sdk) Unit & Security Tests', () => {
  const ALICE_ACCOUNT = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
  const BOB_ACCOUNT = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
  const REVIEWER_1 = privateKeyToAccount('0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6')
  const REVIEWER_2 = privateKeyToAccount('0xf214ab6113087220388e9ee514ec6093be45054f1079e42f18b32f95ec84c51b')

  let simulatedTime = Math.floor(Date.now() / 1000)

  function setupTestEnvironment() {
    simulatedTime = Math.floor(Date.now() / 1000)
    const capsuleDb = new Map()
    const reviewerApprovals = new Map()
    const authorizedRecipients = new Map()

    const registryAddress = '0x1111111111111111111111111111111111111111'
    const mockRegistryClient = {
      async createCapsule(p) {
        capsuleDb.set(p.capsuleId.toLowerCase(), { ...p, approvalCount: 0, revoked: false, exists: true })
        reviewerApprovals.set(p.capsuleId.toLowerCase(), new Set())
        authorizedRecipients.set(p.capsuleId.toLowerCase(), new Set())
        return '0xtx_create'
      },
      async authorizeRecipient(cId, rcpt) {
        const set = authorizedRecipients.get(cId.toLowerCase()) || new Set()
        set.add(rcpt.toLowerCase())
        authorizedRecipients.set(cId.toLowerCase(), set)
        return '0xtx_auth'
      },
      async approveRelease(cId) {
        const cap = capsuleDb.get(cId.toLowerCase())
        const set = reviewerApprovals.get(cId.toLowerCase())
        set.add(`rev_${set.size + 1}`)
        cap.approvalCount = set.size
        return '0xtx_approve'
      },
      async revokeCapsule(cId) {
        const cap = capsuleDb.get(cId.toLowerCase())
        if (cap) cap.revoked = true
        return '0xtx_revoke'
      },
      async isReleaseReady(cId) {
        const cap = capsuleDb.get(cId.toLowerCase())
        if (!cap || cap.revoked) return false
        if (simulatedTime < Number(cap.unlockTimestamp)) return false
        if (Number(cap.expiryTimestamp) !== 0 && simulatedTime > Number(cap.expiryTimestamp)) return false
        return cap.approvalCount >= Number(cap.threshold)
      },
      async isReleaseReadyForRecipient(cId, rcpt) {
        const ready = await this.isReleaseReady(cId)
        if (!ready) return false
        const set = authorizedRecipients.get(cId.toLowerCase())
        return set ? set.has(rcpt.toLowerCase()) : false
      },
      async getCapsule(cId) {
        return capsuleDb.get(cId.toLowerCase())
      },
      async getReviewers() {
        return [REVIEWER_1.address, REVIEWER_2.address]
      },
    }

    const publicClientMock = {
      readContract: async ({ functionName, args }) => {
        if (functionName === 'isReleaseReady') return mockRegistryClient.isReleaseReady(args[0])
        if (functionName === 'isReleaseReadyForRecipient') return mockRegistryClient.isReleaseReadyForRecipient(args[0], args[1])
        if (functionName === 'getCapsule') return mockRegistryClient.getCapsule(args[0])
        return null
      },
    }

    const gA = createGuardianCore({ guardianId: 'g-alpha', publicClient: publicClientMock, registryAddress, now: () => simulatedTime * 1000 })
    const gB = createGuardianCore({ guardianId: 'g-beta', publicClient: publicClientMock, registryAddress, now: () => simulatedTime * 1000 })
    const gC = createGuardianCore({ guardianId: 'g-gamma', publicClient: publicClientMock, registryAddress, now: () => simulatedTime * 1000 })

    const guardians = [
      new DirectGuardianAdapter(gA),
      new DirectGuardianAdapter(gB),
      new DirectGuardianAdapter(gC),
    ]

    const storage = new MemoryStorageAdapter()

    const client = new VeilClient({
      registryAddress,
      publicClient: mockRegistryClient,
      guardians,
      storage,
      defaultWallet: new ViemAccountWalletAdapter(ALICE_ACCOUNT),
    })

    return { client, storage, guardians, mockRegistryClient, registryAddress }
  }

  // 1. Client Initialization
  it('initializes VeilClient with custom and default adapters', () => {
    const { client } = setupTestEnvironment()
    assert.ok(client.capsules)
    assert.ok(client.recipients)
    assert.equal(client.guardians.length, 3)
    assert.ok(client.storage)
    assert.ok(client.registry)
  })

  // 2. Capsule Creation & Validation
  it('creates an encrypted capsule and returns carrier text without leaking secrets', async () => {
    const { client } = setupTestEnvironment()
    const secret = 'TOP_SECRET_RESEARCH_PAYLOAD_2026'

    const created = await client.capsules.create({
      title: 'Advisory',
      content: secret,
      policy: {
        unlockAt: simulatedTime + 3600,
        expiresAt: simulatedTime + 86400,
        threshold: 2,
        reviewers: [REVIEWER_1.address, REVIEWER_2.address],
        requireWorldId: true,
        requiredOrg: 'paycore',
        requiredRole: 'Security Lead',
      },
      recipients: [BOB_ACCOUNT.address],
    })

    assert.ok(created.capsuleId.startsWith('0x'))
    assert.ok(created.policyHash.startsWith('0x'))
    assert.ok(created.ciphertextHash.startsWith('0x'))
    assert.equal(created.status, 'created')
    assert.ok(typeof created.carrierText === 'string')
    assert.ok(created.carrierText.split(' ').length >= 64)

    // Security check: Raw secret or DEK is never exposed in returned object
    assert.equal(JSON.stringify(created).includes(secret), false)
    assert.equal('dek' in created, false)
    assert.equal('rawShares' in created, false)
  })

  // 3. Validation Failures
  it('fails closed when create parameters are invalid', async () => {
    const { client } = setupTestEnvironment()
    await assert.rejects(
      () => client.capsules.create({ content: '', policy: { threshold: 2, reviewers: [REVIEWER_1.address], unlockAt: 100 } }),
      InvalidParameterError
    )
    await assert.rejects(
      () => client.capsules.create({ content: 'test', policy: { threshold: 0, reviewers: [REVIEWER_1.address], unlockAt: 100 } }),
      InvalidParameterError
    )
    await assert.rejects(
      () => client.capsules.create({ content: 'test', policy: { threshold: 2, reviewers: [], unlockAt: 100 } }),
      InvalidParameterError
    )
  })

  // 4. Capsule Inspection
  it('inspects capsule status and requirements accurately', async () => {
    const { client } = setupTestEnvironment()
    const created = await client.capsules.create({
      content: 'test-secret',
      policy: {
        unlockAt: simulatedTime + 500,
        threshold: 2,
        reviewers: [REVIEWER_1.address, REVIEWER_2.address],
      },
      recipients: [BOB_ACCOUNT.address],
    })

    const details = await client.capsules.get(created.capsuleId, BOB_ACCOUNT.address)
    assert.equal(details.capsuleId.toLowerCase(), created.capsuleId.toLowerCase())
    assert.equal(details.threshold, 2)
    assert.equal(details.approvalCount, 0)
    assert.equal(details.isReleaseReady, false)
    assert.equal(details.isRecipientAuthorized, false) // False because timelock is active
    assert.equal(details.requirements.timeSatisfied, false)
    assert.equal(details.requirements.quorumSatisfied, false)
  })

  // 5. Approvals Submission
  it('records reviewer approvals and updates quorum', async () => {
    const { client } = setupTestEnvironment()
    const created = await client.capsules.create({
      content: 'test-secret',
      policy: {
        unlockAt: simulatedTime + 500,
        threshold: 2,
        reviewers: [REVIEWER_1.address, REVIEWER_2.address],
      },
    })

    await client.capsules.approve({ capsuleId: created.capsuleId, signer: new ViemAccountWalletAdapter(REVIEWER_1) })
    let details = await client.capsules.get(created.capsuleId)
    assert.equal(details.approvalCount, 1)

    await client.capsules.approve({ capsuleId: created.capsuleId, signer: new ViemAccountWalletAdapter(REVIEWER_2) })
    details = await client.capsules.get(created.capsuleId)
    assert.equal(details.approvalCount, 2)
    assert.equal(details.requirements.quorumSatisfied, true)
  })

  // 6. Security: Locked Capsule Fails Decryption
  it('blocks premature decryption when capsule is locked', async () => {
    const { client } = setupTestEnvironment()
    const created = await client.capsules.create({
      content: 'timelocked-secret',
      policy: {
        unlockAt: simulatedTime + 1000,
        threshold: 2,
        reviewers: [REVIEWER_1.address, REVIEWER_2.address],
      },
      recipients: [BOB_ACCOUNT.address],
    })

    await assert.rejects(
      () => client.capsules.decrypt({
        carrierText: created.carrierText,
        recipient: new ViemAccountWalletAdapter(BOB_ACCOUNT),
        nowSec: simulatedTime,
      }),
      CapsuleLockedError
    )
  })

  // 7. Security: Revoked Capsule Fails Decryption
  it('blocks decryption when capsule has been revoked onchain', async () => {
    const { client, mockRegistryClient } = setupTestEnvironment()
    const created = await client.capsules.create({
      content: 'revoked-secret',
      policy: {
        unlockAt: simulatedTime + 10,
        threshold: 2,
        reviewers: [REVIEWER_1.address, REVIEWER_2.address],
      },
      recipients: [BOB_ACCOUNT.address],
    })

    await mockRegistryClient.revokeCapsule(created.capsuleId)

    await assert.rejects(
      () => client.capsules.decrypt({
        carrierText: created.carrierText,
        recipient: new ViemAccountWalletAdapter(BOB_ACCOUNT),
        nowSec: simulatedTime + 20,
      }),
      CapsuleRevokedError
    )
  })

  // 8. Security: Expired Capsule Fails Decryption
  it('blocks decryption when expiry deadline has passed', async () => {
    const { client } = setupTestEnvironment()
    const created = await client.capsules.create({
      content: 'expiring-secret',
      policy: {
        unlockAt: simulatedTime + 10,
        expiresAt: simulatedTime + 100,
        threshold: 2,
        reviewers: [REVIEWER_1.address, REVIEWER_2.address],
      },
      recipients: [BOB_ACCOUNT.address],
    })

    await assert.rejects(
      () => client.capsules.decrypt({
        carrierText: created.carrierText,
        recipient: new ViemAccountWalletAdapter(BOB_ACCOUNT),
        nowSec: simulatedTime + 200, // past expiry
      }),
      CapsuleExpiredError
    )
  })

  // 9. Security: Ciphertext Tampering Fails Integrity Check
  it('fails closed when stored ciphertext is corrupted or tampered with', async () => {
    const { client } = setupTestEnvironment()
    const created = await client.capsules.create({
      content: 'tamper-secret',
      policy: {
        unlockAt: simulatedTime + 10,
        threshold: 2,
        reviewers: [REVIEWER_1.address, REVIEWER_2.address],
      },
      recipients: [BOB_ACCOUNT.address],
    })

    // Approve quorum
    await client.capsules.approve({ capsuleId: created.capsuleId, signer: new ViemAccountWalletAdapter(REVIEWER_1) })
    await client.capsules.approve({ capsuleId: created.capsuleId, signer: new ViemAccountWalletAdapter(REVIEWER_2) })
    simulatedTime += 20

    // Tamper with ciphertext bytes in descriptor
    const tamperedDescriptor = new Uint8Array(created.descriptor.rawBytes)
    tamperedDescriptor[tamperedDescriptor.length - 1] ^= 0xff

    await assert.rejects(
      () => client.capsules.decrypt({
        descriptor: tamperedDescriptor,
        recipient: new ViemAccountWalletAdapter(BOB_ACCOUNT),
        nowSec: simulatedTime,
      }),
      CiphertextIntegrityError
    )
  })

  // 10. Security: Insufficient Guardian Shares Fails Closed
  it('fails closed if fewer than threshold guardians respond', async () => {
    const { client, mockRegistryClient, registryAddress } = setupTestEnvironment()
    const created = await client.capsules.create({
      content: 'threshold-secret',
      policy: {
        unlockAt: simulatedTime + 10,
        threshold: 2,
        reviewers: [REVIEWER_1.address, REVIEWER_2.address],
      },
      recipients: [BOB_ACCOUNT.address],
    })

    await client.capsules.approve({ capsuleId: created.capsuleId, signer: new ViemAccountWalletAdapter(REVIEWER_1) })
    await client.capsules.approve({ capsuleId: created.capsuleId, signer: new ViemAccountWalletAdapter(REVIEWER_2) })
    simulatedTime += 50

    // Offline guardian mock that throws
    const offlineGuardian = {
      guardianId: 'dead-node',
      async getPublicKey() { return '00'.repeat(32) },
      async depositShare() { return { ok: true, shareIndex: 1, guardianId: 'dead-node' } },
      async requestShare() { throw new Error('Network timeout') },
    }

    const offlineClient = new VeilClient({
      registryAddress,
      publicClient: mockRegistryClient,
      guardians: [offlineGuardian, offlineGuardian], // 0 valid responses
      storage: client.storage,
      defaultWallet: new ViemAccountWalletAdapter(BOB_ACCOUNT),
    })

    await assert.rejects(
      () => offlineClient.capsules.decrypt({
        carrierText: created.carrierText,
        recipient: new ViemAccountWalletAdapter(BOB_ACCOUNT),
        nowSec: simulatedTime,
      }),
      InsufficientGuardianSharesError
    )
  })

  // 11. Full End-to-End Happy Path via SDK
  it('successfully decrypts secret and outputs cryptographic receipt when all conditions are met', async () => {
    const { client } = setupTestEnvironment()
    const originalSecret = 'VEIL_PRODUCTION_DEPLOYMENT_KEY_2026'

    const created = await client.capsules.create({
      title: 'Production Key',
      content: originalSecret,
      policy: {
        unlockAt: simulatedTime + 100,
        threshold: 2,
        reviewers: [REVIEWER_1.address, REVIEWER_2.address],
        requireWorldId: true,
        requiredOrg: 'paycore',
        requiredRole: 'Security Lead',
      },
      recipients: [BOB_ACCOUNT.address],
    })

    // Reviewers approve
    await client.capsules.approve({ capsuleId: created.capsuleId, signer: new ViemAccountWalletAdapter(REVIEWER_1) })
    await client.capsules.approve({ capsuleId: created.capsuleId, signer: new ViemAccountWalletAdapter(REVIEWER_2) })

    // Time advances past unlock
    simulatedTime += 200

    // Recipient identity proofs
    const bobEph = genKeyPair()
    const worldProof = generateMockWorldProof({
      capsuleId: created.capsuleId,
      recipient: BOB_ACCOUNT.address,
      recipientPub: toHex(bobEph.pub),
    })
    const orgCredential = await issueOrgCredential({
      orgId: 'paycore',
      authorityPrivateKey: TEST_ORGS.paycore.privateKey,
      recipient: BOB_ACCOUNT.address,
      role: 'Security Lead',
      capsuleScope: created.capsuleId,
      now: () => simulatedTime * 1000,
    })

    // Decrypt locally
    const decrypted = await client.capsules.decrypt({
      carrierText: created.carrierText,
      recipient: new ViemAccountWalletAdapter(BOB_ACCOUNT),
      ephemeralPrivateKey: bobEph.priv,
      worldProof,
      organizationCredential: orgCredential,
      nowSec: simulatedTime,
    })

    assert.equal(decrypted.text, originalSecret)
    assert.equal(decrypted.capsuleId.toLowerCase(), created.capsuleId.toLowerCase())
    assert.ok(decrypted.receipt)
    assert.equal(decrypted.receipt.clientExecution.decryptionSuccess, true)
    assert.equal(decrypted.receipt.guardianRelease.sharesCollected >= 2, true)
    assert.equal(decrypted.receipt.identityVerification.worldId.verified, true)
    assert.equal(decrypted.receipt.identityVerification.organizationalRole.role, 'Security Lead')
  })
})
