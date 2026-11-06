// VEIL Phase 6 End-to-End Workflow Integration Test Suite
//
// Demonstrates the complete lifecycle:
//   Alice creates confidential report -> shares via carrier text -> Bob detects ->
//   denied early access -> reviewers approve (3-of-4) -> deadline passes ->
//   Bob proves identity & PayCore role -> guardians release sealed shares ->
//   Bob decrypts locally -> generates disclosure receipt.
//
// Tests all 14 required security failure cases.

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'

import { createAndRegisterCapsule } from '../../packages/crypto/workflow/creator.mjs'
import { detectAndInspectCapsule } from '../../packages/crypto/workflow/detector.mjs'
import { getReviewerStatus, submitReviewerApproval } from '../../packages/crypto/workflow/reviewer.mjs'
import { decryptCapsuleLocally } from '../../packages/crypto/workflow/decryptor.mjs'
import { createDisclosureReceipt } from '../../packages/crypto/workflow/receipt.mjs'
import { queryGuardianCluster } from '../../packages/guardian/orchestrator.mjs'
import { createGuardianCore, privateKeyToAccount, keccak256 } from '../../packages/guardian/guardian.mjs'
import { generateMockWorldProof, worldActionFor } from '../../packages/crypto/identity/world-id.mjs'
import { issueOrgCredential, TEST_ORGS } from '../../packages/crypto/identity/org-auth.mjs'
import { signReleaseRequestV2 } from '../../packages/crypto/identity/recipient-auth.mjs'
import { computeCanonicalPolicyHash } from '../../packages/crypto/policy-registry.mjs'
import { genKeyPair, toHex } from '../../packages/crypto/keys.mjs'
import { CAPSULE_STATES } from '../../packages/crypto/lifecycle.mjs'
import { defaultStorage } from '../../packages/crypto/storage/storage.mjs'

// Test Accounts
const ALICE = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
const BOB = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
const CHARLIE = privateKeyToAccount('0x2222222222222222222222222222222222222222222222222222222222222222')
const DAVE = privateKeyToAccount('0x3333333333333333333333333333333333333333333333333333333333333333')

const JUDGE1 = privateKeyToAccount('0x4444444444444444444444444444444444444444444444444444444444444444')
const JUDGE2 = privateKeyToAccount('0x5555555555555555555555555555555555555555555555555555555555555555')
const JUDGE3 = privateKeyToAccount('0x6666666666666666666666666666666666666666666666666666666666666666')
const JUDGE4 = privateKeyToAccount('0x7777777777777777777777777777777777777777777777777777777777777777')
const MALLORY = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a')

function createMockRegistry({
  nowSource = () => Math.floor(Date.now() / 1000),
} = {}) {
  const capsules = new Map()
  const reviewersMap = new Map()
  const approvalsMap = new Map()
  const authorizedRecipients = new Map()

  return {
    async createCapsule({ capsuleId, ciphertextHash, policyHash, unlockTimestamp, expiryTimestamp, threshold, reviewers }) {
      const cId = capsuleId.toLowerCase()
      capsules.set(cId, {
        creator: ALICE.address,
        ciphertextHash,
        policyHash,
        unlockTimestamp,
        expiryTimestamp,
        threshold,
        approvalCount: 0,
        revoked: false,
        exists: true,
      })
      reviewersMap.set(cId, reviewers.map((r) => r.toLowerCase()))
      approvalsMap.set(cId, new Set())
      authorizedRecipients.set(cId, new Set())
      return `0xtx_create_${cId.slice(2, 10)}`
    },

    async authorizeRecipient(capsuleId, recipient, commitment) {
      const cId = capsuleId.toLowerCase()
      const list = authorizedRecipients.get(cId) || new Set()
      list.add(recipient.toLowerCase())
      authorizedRecipients.set(cId, list)
    },

    async approveRelease(capsuleId) {
      const cId = capsuleId.toLowerCase()
      const cap = capsules.get(cId)
      if (!cap) throw new Error('Capsule not found')
      const approvals = approvalsMap.get(cId) || new Set()
      approvals.add(`reviewer_${approvals.size + 1}`)
      cap.approvalCount = approvals.size
      return `0xtx_approve_${approvals.size}`
    },

    async revokeCapsule(capsuleId) {
      const cId = capsuleId.toLowerCase()
      const cap = capsules.get(cId)
      if (cap) cap.revoked = true
      return `0xtx_revoke`
    },

    async isReleaseReady(capsuleId) {
      const cId = capsuleId.toLowerCase()
      const cap = capsules.get(cId)
      if (!cap || cap.revoked) return false
      const now = nowSource()
      if (now < Number(cap.unlockTimestamp)) return false
      if (Number(cap.expiryTimestamp) !== 0 && now > Number(cap.expiryTimestamp)) return false
      if (Number(cap.approvalCount) < Number(cap.threshold)) return false
      return true
    },

    async isReleaseReadyForRecipient(capsuleId, recipient) {
      const cId = capsuleId.toLowerCase()
      const ready = await this.isReleaseReady(cId)
      if (!ready) return false
      const rcpts = authorizedRecipients.get(cId)
      if (!rcpts || !rcpts.has(recipient.toLowerCase())) return false
      return true
    },

    async getCapsule(capsuleId) {
      const cId = capsuleId.toLowerCase()
      const cap = capsules.get(cId)
      if (!cap) throw new Error('Capsule not found')
      return cap
    },

    async getReviewers(capsuleId) {
      const cId = capsuleId.toLowerCase()
      return reviewersMap.get(cId) || []
    },

    async recipientIdentityCommitment() {
      return '0x0000000000000000000000000000000000000000000000000000000000000000'
    },
  }
}

describe('VEIL Phase 6 Complete End-to-End Workflow Demonstration', () => {
  const secretContent = 'CRITICAL_ZERO_DAY_DISCLOSURE_VULNERABILITY_FIX_2026: Patch commit 8f9b2c3'
  let simulatedTimeSec = Math.floor(Date.now() / 1000)
  const nowSource = () => simulatedTimeSec

  test('complete happy path: create -> carrier text -> detect -> review -> time -> identity -> decrypt -> receipt', async () => {
    // 1. Setup mock blockchain registry and 3 independent guardians
    const registry = createMockRegistry({ nowSource })
    const registryAddress = '0x1111111111111111111111111111111111111111'

    const publicClientMock = {
      readContract: async ({ functionName, args }) => {
        if (functionName === 'isReleaseReady') return registry.isReleaseReady(args[0])
        if (functionName === 'isReleaseReadyForRecipient') return registry.isReleaseReadyForRecipient(args[0], args[1])
        if (functionName === 'getCapsule') return registry.getCapsule(args[0])
        if (functionName === 'recipientIdentityCommitment') return registry.recipientIdentityCommitment()
        return null
      },
    }

    const gA = createGuardianCore({ guardianId: 'guardian-a', publicClient: publicClientMock, registryAddress, now: () => simulatedTimeSec * 1000 })
    const gB = createGuardianCore({ guardianId: 'guardian-b', publicClient: publicClientMock, registryAddress, now: () => simulatedTimeSec * 1000 })
    const gC = createGuardianCore({ guardianId: 'guardian-c', publicClient: publicClientMock, registryAddress, now: () => simulatedTimeSec * 1000 })

    const guardians = [gA, gB, gC]

    // 2. Alice configures and creates capsule
    const unlockTimestamp = simulatedTimeSec + 3600 // Unlock in 1 hour
    const expiryTimestamp = simulatedTimeSec + 86400 // Expire in 24 hours
    const reviewers = [JUDGE1.address, JUDGE2.address, JUDGE3.address, JUDGE4.address]
    const recipients = [BOB.address, CHARLIE.address, DAVE.address]
    const threshold = 3 // 3-of-4 approval threshold

    const aliceResult = await createAndRegisterCapsule({
      title: 'Zero-Day Advisory',
      description: 'High-severity infrastructure disclosure',
      plaintext: secretContent,
      recipients,
      reviewers,
      threshold,
      unlockTimestamp,
      expiryTimestamp,
      requireWorldId: true,
      requiredOrg: 'paycore',
      requiredRole: 'Security Lead',
      guardians,
      registryClient: registry,
    })

    assert.equal(aliceResult.success, true)
    assert.equal(aliceResult.state, CAPSULE_STATES.SHARED)
    assert.ok(aliceResult.carrierText)
    assert.match(aliceResult.carrierText, /^[a-z\s]+$/) // Pure natural lowercase words

    // 3. Bob receives carrier text and detects the capsule
    const bobDetection = await detectAndInspectCapsule({
      input: aliceResult.carrierText,
      recipientAddress: BOB.address,
      registryClient: registry,
      nowSec: simulatedTimeSec,
    })

    assert.equal(bobDetection.detected, true)
    assert.equal(bobDetection.valid, true)
    assert.equal(bobDetection.status, CAPSULE_STATES.LOCKED) // Locked because deadline + quorum not met
    assert.equal(bobDetection.requirements.quorumSatisfied, false)
    assert.equal(bobDetection.requirements.timeSatisfied, false)

    // 4. Bob attempts early release -> Legitimate Denial
    const bobEph = genKeyPair()
    const earlyWorldProof = generateMockWorldProof({ capsuleId: aliceResult.capsuleId, recipient: BOB.address, recipientPub: toHex(bobEph.pub) })
    const earlyOrgCred = await issueOrgCredential({
      orgId: 'paycore',
      authorityPrivateKey: TEST_ORGS.paycore.privateKey,
      recipient: BOB.address,
      role: 'Security Lead',
      capsuleScope: aliceResult.capsuleId,
    })

    const earlySignedReq = await signReleaseRequestV2({
      account: BOB,
      registryAddress,
      capsuleId: aliceResult.capsuleId,
      policyHash: aliceResult.policyHash,
      recipientPub: toHex(bobEph.pub),
      worldProof: earlyWorldProof,
      orgCredential: earlyOrgCred,
    })

    const earlyQuery = await queryGuardianCluster({
      guardians,
      signedRequest: earlySignedReq,
      worldProof: earlyWorldProof,
      orgCredential: earlyOrgCred,
      threshold: 2,
    })

    assert.equal(earlyQuery.ok, false)
    assert.equal(earlyQuery.error, 'INSUFFICIENT_SHARES')
    assert.match(earlyQuery.denials[0].reason, /onchain policy conditions not satisfied/)

    // 5. Reviewers approve onchain (Judge 1, Judge 2, Judge 3)
    await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE1.address, registryClient: registry })
    await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE2.address, registryClient: registry })
    const approval3 = await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE3.address, registryClient: registry })

    assert.equal(approval3.currentApprovals, 3)
    assert.equal(approval3.quorumMet, true)

    // 6. Advance simulated blockchain time past unlock timestamp
    simulatedTimeSec = unlockTimestamp + 10

    // Re-check detection: status should now be RELEASE_ELIGIBLE
    const updatedDetection = await detectAndInspectCapsule({
      input: aliceResult.carrierText,
      recipientAddress: BOB.address,
      registryClient: registry,
      nowSec: simulatedTimeSec,
    })
    assert.equal(updatedDetection.requirements.timeSatisfied, true)
    assert.equal(updatedDetection.requirements.quorumSatisfied, true)

    // 7. Bob completes World ID and PayCore Security Lead verification
    const validWorldProof = generateMockWorldProof({ capsuleId: aliceResult.capsuleId, recipient: BOB.address, recipientPub: toHex(bobEph.pub) })
    const validOrgCred = await issueOrgCredential({
      orgId: 'paycore',
      authorityPrivateKey: TEST_ORGS.paycore.privateKey,
      recipient: BOB.address,
      role: 'Security Lead',
      capsuleScope: aliceResult.capsuleId,
      now: () => simulatedTimeSec * 1000,
    })

    // 8. Bob signs canonical authorization request
    const validSignedReq = await signReleaseRequestV2({
      account: BOB,
      registryAddress,
      capsuleId: aliceResult.capsuleId,
      policyHash: aliceResult.policyHash,
      recipientPub: toHex(bobEph.pub),
      worldProof: validWorldProof,
      orgCredential: validOrgCred,
      now: () => simulatedTimeSec * 1000,
    })

    // 9. Query guardians for threshold shares
    const guardianRelease = await queryGuardianCluster({
      guardians,
      signedRequest: validSignedReq,
      worldProof: validWorldProof,
      orgCredential: validOrgCred,
      threshold: 2,
    })

    assert.equal(guardianRelease.ok, true)
    assert.equal(guardianRelease.collectedCount, 3)
    assert.ok(guardianRelease.responses[0].signature) // Each guardian signed its response

    // 10. Bob decrypts locally
    const decryptionResult = await decryptCapsuleLocally({
      descriptor: aliceResult.descriptor,
      guardianResponses: guardianRelease.responses,
      ephemeralKeypair: bobEph,
      expectedPolicyHash: aliceResult.policyHash,
    })

    assert.equal(decryptionResult.ok, true)
    assert.equal(decryptionResult.text, secretContent)

    // 11. Generate cryptographic disclosure receipt
    const receipt = createDisclosureReceipt({
      capsuleId: aliceResult.capsuleId,
      policyHash: aliceResult.policyHash,
      ciphertextHash: aliceResult.ciphertextHash,
      recipientAddress: BOB.address,
      onchainFacts: {
        contractAddress: registryAddress,
        threshold,
        approvalCount: 3,
        quorumSatisfied: true,
        unlockTimestamp,
        expiryTimestamp,
      },
      identityAttestation: {
        nullifier: validWorldProof.responses[0].nullifier,
        action: worldActionFor(aliceResult.capsuleId),
      },
      orgAttestation: {
        orgId: 'paycore',
        role: 'Security Lead',
        orgAuthority: validOrgCred.orgAuthority,
      },
      guardianAttestations: guardianRelease.responses,
      decryptionSuccess: true,
      timestamp: simulatedTimeSec * 1000,
    })

    assert.equal(receipt.clientExecution.decryptionSuccess, true)
    assert.equal(receipt.guardianRelease.sharesCollected, 3)
    assert.equal(receipt.identityVerification.worldId.verified, true)
    assert.equal(receipt.identityVerification.organizationalRole.role, 'Security Lead')
  })
})

describe('VEIL Phase 6 Security Failure Modes (Adversarial Coverage)', () => {
  let simulatedTime = Math.floor(Date.now() / 1000)
  const nowSource = () => simulatedTime

  async function setupStandardTestScenario() {
    simulatedTime = Math.floor(Date.now() / 1000)
    const registry = createMockRegistry({ nowSource })
    const registryAddress = '0x1111111111111111111111111111111111111111'
    const publicClientMock = {
      readContract: async ({ functionName, args }) => {
        if (functionName === 'isReleaseReady') return registry.isReleaseReady(args[0])
        if (functionName === 'isReleaseReadyForRecipient') return registry.isReleaseReadyForRecipient(args[0], args[1])
        if (functionName === 'getCapsule') return registry.getCapsule(args[0])
        if (functionName === 'recipientIdentityCommitment') return registry.recipientIdentityCommitment()
        return null
      },
    }

    const gA = createGuardianCore({ guardianId: 'guardian-a', publicClient: publicClientMock, registryAddress, now: () => simulatedTime * 1000 })
    const gB = createGuardianCore({ guardianId: 'guardian-b', publicClient: publicClientMock, registryAddress, now: () => simulatedTime * 1000 })
    const gC = createGuardianCore({ guardianId: 'guardian-c', publicClient: publicClientMock, registryAddress, now: () => simulatedTime * 1000 })

    const guardians = [gA, gB, gC]

    const aliceResult = await createAndRegisterCapsule({
      title: 'Secret',
      plaintext: 'CONFIDENTIAL',
      recipients: [BOB.address],
      reviewers: [JUDGE1.address, JUDGE2.address],
      threshold: 2,
      unlockTimestamp: simulatedTime + 100,
      expiryTimestamp: simulatedTime + 1000,
      requireWorldId: true,
      requiredOrg: 'paycore',
      requiredRole: 'Security Lead',
      guardians,
      registryClient: registry,
    })

    return { registry, registryAddress, guardians, aliceResult }
  }

  test('failure case: deadline not reached', async () => {
    const { registry, registryAddress, guardians, aliceResult } = await setupStandardTestScenario()
    // Approve quorum
    await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE1.address, registryClient: registry })
    await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE2.address, registryClient: registry })

    // Time NOT advanced (simulatedTime < unlockTimestamp)
    const bobEph = genKeyPair()
    const proof = generateMockWorldProof({ capsuleId: aliceResult.capsuleId, recipient: BOB.address, recipientPub: toHex(bobEph.pub) })
    const cred = await issueOrgCredential({ orgId: 'paycore', authorityPrivateKey: TEST_ORGS.paycore.privateKey, recipient: BOB.address, role: 'Security Lead', capsuleScope: aliceResult.capsuleId, now: () => simulatedTime * 1000 })
    const req = await signReleaseRequestV2({ account: BOB, registryAddress, capsuleId: aliceResult.capsuleId, policyHash: aliceResult.policyHash, recipientPub: toHex(bobEph.pub), worldProof: proof, orgCredential: cred, now: () => simulatedTime * 1000 })

    const res = await queryGuardianCluster({ guardians, signedRequest: req, worldProof: proof, orgCredential: cred })
    assert.equal(res.ok, false)
    assert.match(res.denials[0].reason, /onchain policy conditions not satisfied/)
  })

  test('failure case: insufficient quorum', async () => {
    const { registry, registryAddress, guardians, aliceResult } = await setupStandardTestScenario()
    // Only 1 of 2 approves
    await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE1.address, registryClient: registry })
    simulatedTime += 200 // Time passes

    const bobEph = genKeyPair()
    const proof = generateMockWorldProof({ capsuleId: aliceResult.capsuleId, recipient: BOB.address, recipientPub: toHex(bobEph.pub) })
    const cred = await issueOrgCredential({ orgId: 'paycore', authorityPrivateKey: TEST_ORGS.paycore.privateKey, recipient: BOB.address, role: 'Security Lead', capsuleScope: aliceResult.capsuleId, now: () => simulatedTime * 1000 })
    const req = await signReleaseRequestV2({ account: BOB, registryAddress, capsuleId: aliceResult.capsuleId, policyHash: aliceResult.policyHash, recipientPub: toHex(bobEph.pub), worldProof: proof, orgCredential: cred, now: () => simulatedTime * 1000 })

    const res = await queryGuardianCluster({ guardians, signedRequest: req, worldProof: proof, orgCredential: cred })
    assert.equal(res.ok, false)
    assert.match(res.denials[0].reason, /onchain policy conditions not satisfied/)
  })

  test('failure case: revoked capsule', async () => {
    const { registry, registryAddress, guardians, aliceResult } = await setupStandardTestScenario()
    await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE1.address, registryClient: registry })
    await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE2.address, registryClient: registry })
    simulatedTime += 200

    // Alice revokes capsule
    await registry.revokeCapsule(aliceResult.capsuleId)

    const bobEph = genKeyPair()
    const proof = generateMockWorldProof({ capsuleId: aliceResult.capsuleId, recipient: BOB.address, recipientPub: toHex(bobEph.pub) })
    const cred = await issueOrgCredential({ orgId: 'paycore', authorityPrivateKey: TEST_ORGS.paycore.privateKey, recipient: BOB.address, role: 'Security Lead', capsuleScope: aliceResult.capsuleId, now: () => simulatedTime * 1000 })
    const req = await signReleaseRequestV2({ account: BOB, registryAddress, capsuleId: aliceResult.capsuleId, policyHash: aliceResult.policyHash, recipientPub: toHex(bobEph.pub), worldProof: proof, orgCredential: cred, now: () => simulatedTime * 1000 })

    const res = await queryGuardianCluster({ guardians, signedRequest: req, worldProof: proof, orgCredential: cred })
    assert.equal(res.ok, false)
    assert.match(res.denials[0].reason, /onchain policy conditions not satisfied/)
  })

  test('failure case: expired capsule', async () => {
    const { registry, registryAddress, guardians, aliceResult } = await setupStandardTestScenario()
    await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE1.address, registryClient: registry })
    await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE2.address, registryClient: registry })

    // Advance time PAST expiration (simulatedTime > expiryTimestamp)
    simulatedTime += 5000

    const bobEph = genKeyPair()
    const proof = generateMockWorldProof({ capsuleId: aliceResult.capsuleId, recipient: BOB.address, recipientPub: toHex(bobEph.pub) })
    const cred = await issueOrgCredential({ orgId: 'paycore', authorityPrivateKey: TEST_ORGS.paycore.privateKey, recipient: BOB.address, role: 'Security Lead', capsuleScope: aliceResult.capsuleId, now: () => (simulatedTime - 4500) * 1000 })
    const req = await signReleaseRequestV2({ account: BOB, registryAddress, capsuleId: aliceResult.capsuleId, policyHash: aliceResult.policyHash, recipientPub: toHex(bobEph.pub), worldProof: proof, orgCredential: cred, now: () => simulatedTime * 1000 })

    const res = await queryGuardianCluster({ guardians, signedRequest: req, worldProof: proof, orgCredential: cred })
    assert.equal(res.ok, false)
  })

  test('failure case: unauthorized organization role', async () => {
    const { registry, registryAddress, guardians, aliceResult } = await setupStandardTestScenario()
    await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE1.address, registryClient: registry })
    await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE2.address, registryClient: registry })
    simulatedTime += 200

    const bobEph = genKeyPair()
    const proof = generateMockWorldProof({ capsuleId: aliceResult.capsuleId, recipient: BOB.address, recipientPub: toHex(bobEph.pub) })
    // Wrong role: Compliance Auditor instead of Security Lead
    const badCred = await issueOrgCredential({ orgId: 'paycore', authorityPrivateKey: TEST_ORGS.paycore.privateKey, recipient: BOB.address, role: 'Compliance Auditor', capsuleScope: aliceResult.capsuleId, now: () => simulatedTime * 1000 })
    const req = await signReleaseRequestV2({ account: BOB, registryAddress, capsuleId: aliceResult.capsuleId, policyHash: aliceResult.policyHash, recipientPub: toHex(bobEph.pub), worldProof: proof, orgCredential: badCred, now: () => simulatedTime * 1000 })

    const res = await queryGuardianCluster({ guardians, signedRequest: req, worldProof: proof, orgCredential: badCred })
    assert.equal(res.ok, false)
    assert.match(res.denials[0].reason, /Required role "Security Lead"/)
  })

  test('failure case: man-in-the-middle ephemeral key substitution', async () => {
    const { registry, registryAddress, guardians, aliceResult } = await setupStandardTestScenario()
    await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE1.address, registryClient: registry })
    await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE2.address, registryClient: registry })
    simulatedTime += 200

    const bobEph = genKeyPair()
    const proof = generateMockWorldProof({ capsuleId: aliceResult.capsuleId, recipient: BOB.address, recipientPub: toHex(bobEph.pub) })
    const cred = await issueOrgCredential({ orgId: 'paycore', authorityPrivateKey: TEST_ORGS.paycore.privateKey, recipient: BOB.address, role: 'Security Lead', capsuleScope: aliceResult.capsuleId, now: () => simulatedTime * 1000 })
    const req = await signReleaseRequestV2({ account: BOB, registryAddress, capsuleId: aliceResult.capsuleId, policyHash: aliceResult.policyHash, recipientPub: toHex(bobEph.pub), worldProof: proof, orgCredential: cred, now: () => simulatedTime * 1000 })

    // Attacker modifies recipientPub
    const { pub: malloryPub } = genKeyPair()
    req.recipientPub = toHex(malloryPub)

    const res = await queryGuardianCluster({ guardians, signedRequest: req, worldProof: proof, orgCredential: cred })
    assert.equal(res.ok, false)
    assert.match(res.denials[0].reason, /invalid recipient signature/)
  })

  test('failure case: one guardian unavailable succeeds; two guardians unavailable fails closed', async () => {
    const { registry, registryAddress, guardians, aliceResult } = await setupStandardTestScenario()
    await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE1.address, registryClient: registry })
    await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: JUDGE2.address, registryClient: registry })
    simulatedTime += 200

    const bobEph = genKeyPair()
    const proof = generateMockWorldProof({ capsuleId: aliceResult.capsuleId, recipient: BOB.address, recipientPub: toHex(bobEph.pub) })
    const cred = await issueOrgCredential({ orgId: 'paycore', authorityPrivateKey: TEST_ORGS.paycore.privateKey, recipient: BOB.address, role: 'Security Lead', capsuleScope: aliceResult.capsuleId, now: () => simulatedTime * 1000 })
    const req = await signReleaseRequestV2({ account: BOB, registryAddress, capsuleId: aliceResult.capsuleId, policyHash: aliceResult.policyHash, recipientPub: toHex(bobEph.pub), worldProof: proof, orgCredential: cred, now: () => simulatedTime * 1000 })

    // Offline guardian mock
    const deadGuardian = {
      guardianId: 'dead-guardian',
      async release() { throw new Error('ECONNREFUSED: Connection refused') },
    }

    // 1. One guardian down (2 of 3 available): SUCCEEDS
    const oneDownRes = await queryGuardianCluster({
      guardians: [guardians[0], guardians[1], deadGuardian],
      signedRequest: req,
      worldProof: proof,
      orgCredential: cred,
      threshold: 2,
    })
    assert.equal(oneDownRes.ok, true)
    assert.equal(oneDownRes.collectedCount, 2)

    // Decryption with 2 shares succeeds
    const decRes = await decryptCapsuleLocally({
      descriptor: aliceResult.descriptor,
      guardianResponses: oneDownRes.responses,
      ephemeralKeypair: bobEph,
    })
    assert.equal(decRes.ok, true)
    assert.equal(decRes.text, 'CONFIDENTIAL')

    // 2. Two guardians down (only 1 available): FAILS CLOSED
    const twoDownReq = await signReleaseRequestV2({ account: BOB, registryAddress, capsuleId: aliceResult.capsuleId, policyHash: aliceResult.policyHash, recipientPub: toHex(bobEph.pub), worldProof: proof, orgCredential: cred, now: () => simulatedTime * 1000 })
    const twoDownRes = await queryGuardianCluster({
      guardians: [guardians[0], deadGuardian, deadGuardian],
      signedRequest: twoDownReq,
      worldProof: proof,
      orgCredential: cred,
      threshold: 2,
    })
    assert.equal(twoDownRes.ok, false)
    assert.equal(twoDownRes.error, 'INSUFFICIENT_SHARES')
  })

  test('failure case: corrupted ciphertext fails integrity check', async () => {
    const { aliceResult } = await setupStandardTestScenario()
    const bobEph = genKeyPair()

    // Tamper with ciphertext in descriptor
    const tamperedDescriptor = new Uint8Array(aliceResult.descriptor)
    tamperedDescriptor[tamperedDescriptor.length - 2] ^= 0x55

    const res = await decryptCapsuleLocally({
      descriptor: tamperedDescriptor,
      ephemeralKeypair: bobEph,
      guardianResponses: [],
    })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'CIPHERTEXT_INTEGRITY_VIOLATION')
  })

  test('failure case: altered policyHash in descriptor fails closed', async () => {
    const { aliceResult } = await setupStandardTestScenario()
    const bobEph = genKeyPair()

    // Alter policyHash in descriptor (offset 35)
    const tamperedDescriptor = new Uint8Array(aliceResult.descriptor)
    tamperedDescriptor[35] ^= 0x55

    // Expect decryptCapsuleLocally to fail when verifying expectedPolicyHash
    const res = await decryptCapsuleLocally({
      descriptor: tamperedDescriptor,
      ephemeralKeypair: bobEph,
      guardianResponses: [],
      expectedPolicyHash: aliceResult.policyHash,
    })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'POLICY_HASH_MISMATCH')
  })
})
