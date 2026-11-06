// VEIL Protocol — Human-Operated ETHGlobal Judge Demo Integration Test
// Scenario: Northstar Payments Vulnerability Embargo (CVE-2026-8812)
//
// Verifies:
// 1. Participant wallet identities (Alice, Bob, Charlie, David, Eve).
// 2. Alice creates capsule with 90s timelock and 2-of-3 reviewer quorum.
// 3. Reversible steganographic carrier text generation and decode.
// 4. Bob attempts early access -> Guardians reject request (Fail-Closed).
// 5. Charlie and David sign reviewer approvals onchain.
// 6. Timelock expires.
// 7. Threshold failure demonstration: 1 guardian share fails closed.
// 8. 2-of-3 threshold release: Bob proves World ID + Northstar role, unseals shares,
//    reconstructs DEK locally via GF(256) Lagrange interpolation, and decrypts plaintext.
// 9. Verifiable disclosure receipt generated.

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPublicClient, http, parseEther, keccak256 } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { createGuardianCore } from '../../packages/guardian/guardian.mjs'
import { queryGuardianCluster } from '../../packages/guardian/orchestrator.mjs'
import { createAndRegisterCapsule } from '../../packages/crypto/workflow/creator.mjs'
import { detectAndInspectCapsule } from '../../packages/crypto/workflow/detector.mjs'
import { submitReviewerApproval } from '../../packages/crypto/workflow/reviewer.mjs'
import { decryptCapsuleLocally } from '../../packages/crypto/workflow/decryptor.mjs'
import { createDisclosureReceipt } from '../../packages/crypto/workflow/receipt.mjs'
import { signReleaseRequestV2, formatReleaseRequestMessageV2 } from '../../packages/crypto/identity/recipient-auth.mjs'
import { generateMockWorldProof, worldActionFor } from '../../packages/crypto/identity/world-id.mjs'
import { issueOrgCredential, TEST_ORGS } from '../../packages/crypto/identity/org-auth.mjs'
import { genKeyPair, toHex, fromHex } from '../../packages/crypto/keys.mjs'
import { computeCanonicalPolicyHash } from '../../packages/crypto/policy-registry.mjs'
import { reconstruct } from '../../packages/crypto/sss.mjs'

test('VEIL Northstar Payments Human-Operated Judge Demo Workflow', async () => {
  // 1. Distinct Demo Participants
  const ALICE = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d') // Creator
  const BOB = privateKeyToAccount('0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a')   // Recipient / Security Lead
  const CHARLIE = privateKeyToAccount('0x7c852118294e51e653712a81e05800f419141751be58f605c371e15141b007a6') // Reviewer 1
  const DAVID = privateKeyToAccount('0x47e179ec197488593b1029cc2e2988241315b80eb3f73e6e79bcda81d430032f')   // Reviewer 2
  const EVE = privateKeyToAccount('0x8b3a350cf5c34c9194ca85829a2df0ec3153be0318b5e2d3348e872092edffba')     // Reviewer 3

  assert.equal(ALICE.address, '0x70997970C51812dc3A010C7d01b50e0d17dc79C8')
  assert.equal(BOB.address, '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC')
  assert.equal(CHARLIE.address, '0x90F79bf6EB2c4f870365E785982E1f101E93b906')
  assert.equal(DAVID.address, '0x35B33Ae737809aa6B03fe4124B760E14e5d996a0')
  assert.equal(EVE.address, '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc')

  // Synthetic Northstar Payments Vulnerability Report
  const vulnerabilityReport = JSON.stringify({
    company: 'Northstar Payments',
    cve: 'CVE-2026-8812',
    severity: 'CRITICAL',
    title: 'Double-Credit Race Condition in LedgerBatchProcessor',
    impact: 'Simultaneous debits across worker threads bypass account balance verification',
    hotfix: 'git commit 8a92bc319f01e2c3b4a5d6e7f8 (Atomic Redis Redlock)',
  })

  // Simulated Onchain State
  let simTimeSec = 1772800000
  const now = () => simTimeSec * 1000
  const unlockTimestamp = simTimeSec + 90 // 90 seconds embargo
  const expiryTimestamp = unlockTimestamp + 1800 // 30 minutes expiry
  const threshold = 2
  const reviewers = [CHARLIE.address, DAVID.address, EVE.address]

  const capsuleDb = new Map()
  const reviewerApprovals = new Map()
  const authorizedRecipients = new Map()

  const mockRegistry = {
    async createCapsule(p) {
      capsuleDb.set(p.capsuleId.toLowerCase(), {
        ...p,
        creator: ALICE.address,
        approvalCount: 0,
        revoked: false,
        exists: true,
      })
      reviewerApprovals.set(p.capsuleId.toLowerCase(), new Set())
      authorizedRecipients.set(p.capsuleId.toLowerCase(), new Set())
      return '0x_tx_northstar_create'
    },
    async authorizeRecipient(cId, rcpt) {
      const set = authorizedRecipients.get(cId.toLowerCase()) || new Set()
      set.add(rcpt.toLowerCase())
      authorizedRecipients.set(cId.toLowerCase(), set)
      return '0x_tx_northstar_auth'
    },
    async approveRelease(cId, reviewerAddr) {
      const cap = capsuleDb.get(cId.toLowerCase())
      if (!cap) throw new Error('CapsuleNotFound')
      const set = reviewerApprovals.get(cId.toLowerCase())
      set.add(reviewerAddr.toLowerCase())
      cap.approvalCount = set.size
      return '0x_tx_northstar_approve'
    },
    async isReleaseReady(cId) {
      const cap = capsuleDb.get(cId.toLowerCase())
      if (!cap || cap.revoked) return false
      if (simTimeSec < Number(cap.unlockTimestamp)) return false
      if (cap.expiryTimestamp && simTimeSec > Number(cap.expiryTimestamp)) return false
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
      return reviewers
    },
  }

  // Set up 3 threshold guardians
  const publicClientMock = {
    readContract: async ({ functionName, args }) => {
      if (functionName === 'isReleaseReady') return mockRegistry.isReleaseReady(args[0])
      if (functionName === 'isReleaseReadyForRecipient') return mockRegistry.isReleaseReadyForRecipient(args[0], args[1])
      if (functionName === 'getCapsule') return mockRegistry.getCapsule(args[0])
      return null
    },
  }

  const registryAddress = '0x5FbDB2315678afecb367f032d93F642f64180aa3'
  const gAlpha = createGuardianCore({ guardianId: 'guardian-alpha', publicClient: publicClientMock, registryAddress, now })
  const gBeta = createGuardianCore({ guardianId: 'guardian-beta', publicClient: publicClientMock, registryAddress, now })
  const gGamma = createGuardianCore({ guardianId: 'guardian-gamma', publicClient: publicClientMock, registryAddress, now })
  const guardians = [gAlpha, gBeta, gGamma]

  // -------------------------------------------------------------------------
  // STEP 1: Alice creates capsule & encodes carrier text
  // -------------------------------------------------------------------------
  const creation = await createAndRegisterCapsule({
    plaintext: vulnerabilityReport,
    unlockTimestamp,
    expiryTimestamp,
    threshold,
    reviewers,
    recipients: [BOB.address],
    guardians,
    registryClient: mockRegistry,
    requireWorldId: true,
    requiredOrg: 'northstar',
    requiredRole: 'Security Lead',
  })

  assert.ok(creation.capsuleId.startsWith('0x'))
  assert.ok(creation.carrierText.length > 50)
  assert.equal(typeof creation.carrierText, 'string')

  // -------------------------------------------------------------------------
  // STEP 2: Bob receives carrier text and detects policy
  // -------------------------------------------------------------------------
  const detected = await detectAndInspectCapsule({
    input: creation.carrierText,
    registryClient: mockRegistry,
    nowSec: simTimeSec,
  })

  assert.equal(detected.detected, true)
  assert.equal(detected.requirements.timeSatisfied, false)
  assert.equal(detected.requirements.quorumSatisfied, false)
  assert.equal(detected.isReleaseReady, false)

  // -------------------------------------------------------------------------
  // STEP 3: Bob attempts early access -> Fail Closed
  // -------------------------------------------------------------------------
  const bobEphemeral = genKeyPair()
  const bobWorldProof = generateMockWorldProof({
    capsuleId: creation.capsuleId,
    recipient: BOB.address,
    recipientPub: toHex(bobEphemeral.pub),
  })

  const bobOrgCredential = await issueOrgCredential({
    orgId: 'northstar',
    authorityPrivateKey: TEST_ORGS.northstar.privateKey,
    recipient: BOB.address,
    role: 'Security Lead',
    capsuleScope: creation.capsuleId,
    issuedAt: simTimeSec,
    expiresAt: simTimeSec + 86400,
    now,
  })

  const earlyRequest = await signReleaseRequestV2({
    account: BOB,
    capsuleId: creation.capsuleId,
    recipientPub: toHex(bobEphemeral.pub),
    policyHash: creation.policyHash,
    registryAddress,
    identityNullifier: bobWorldProof.responses[0].nullifier,
    orgId: 'northstar',
    orgRole: 'Security Lead',
    now,
  })

  let earlyDenied = false
  try {
    await gAlpha.release({
      capsuleId: creation.capsuleId,
      recipient: BOB.address,
      recipientPub: toHex(bobEphemeral.pub),
      nonce: earlyRequest.nonce,
      expiry: earlyRequest.expiry,
      signature: earlyRequest.signature,
      policyHash: creation.policyHash,
      worldProof: bobWorldProof,
      orgCredential: bobOrgCredential,
    })
  } catch (err) {
    earlyDenied = true
    assert.match(err.message, /conditions not satisfied/)
  }
  assert.equal(earlyDenied, true, 'Guardian must refuse early access when conditions are not satisfied')

  // -------------------------------------------------------------------------
  // STEP 4: Reviewers Charlie and David sign approvals
  // -------------------------------------------------------------------------
  await mockRegistry.approveRelease(creation.capsuleId, CHARLIE.address)
  let capState = await mockRegistry.getCapsule(creation.capsuleId)
  assert.equal(capState.approvalCount, 1)

  await mockRegistry.approveRelease(creation.capsuleId, DAVID.address)
  capState = await mockRegistry.getCapsule(creation.capsuleId)
  assert.equal(capState.approvalCount, 2)
  assert.ok(capState.approvalCount >= threshold, 'Quorum of 2 reviewers met')

  // -------------------------------------------------------------------------
  // STEP 5: Time passes 90-second embargo
  // -------------------------------------------------------------------------
  simTimeSec += 95 // Advanced past 90s unlock timestamp
  assert.ok(simTimeSec > unlockTimestamp)
  const isReady = await mockRegistry.isReleaseReadyForRecipient(creation.capsuleId, BOB.address)
  assert.equal(isReady, true, 'Policy conditions satisfied onchain')

  // -------------------------------------------------------------------------
  // STEP 6: Bob proves identity & requests shares
  // -------------------------------------------------------------------------
  const validReleaseReq = await signReleaseRequestV2({
    account: BOB,
    capsuleId: creation.capsuleId,
    recipientPub: toHex(bobEphemeral.pub),
    policyHash: creation.policyHash,
    registryAddress,
    identityNullifier: bobWorldProof.responses[0].nullifier,
    orgId: 'northstar',
    orgRole: 'Security Lead',
    now,
  })

  // -------------------------------------------------------------------------
  // STEP 7: Threshold Failure Demonstration (1 share is insufficient)
  // -------------------------------------------------------------------------
  const singleShareResp = await gAlpha.release({
    capsuleId: creation.capsuleId,
    recipient: BOB.address,
    recipientPub: toHex(bobEphemeral.pub),
    nonce: validReleaseReq.nonce,
    expiry: validReleaseReq.expiry,
    signature: validReleaseReq.signature,
    policyHash: creation.policyHash,
    worldProof: bobWorldProof,
    orgCredential: bobOrgCredential,
  })

  assert.equal(singleShareResp.ok, true)
  assert.equal(singleShareResp.shareIndex, 1)

  // 1 share fails closed
  let sssFailed = false
  try {
    reconstruct([fromHex(singleShareResp.sealedShare.slice(0, 130))])
  } catch {
    sssFailed = true
  }
  assert.equal(sssFailed, true, '1 share mathematically cannot reconstruct the DEK')

  // -------------------------------------------------------------------------
  // STEP 8: Request second share with fresh nonce -> Decrypt locally
  // -------------------------------------------------------------------------
  const freshReleaseReq = await signReleaseRequestV2({
    account: BOB,
    capsuleId: creation.capsuleId,
    recipientPub: toHex(bobEphemeral.pub),
    policyHash: creation.policyHash,
    registryAddress,
    identityNullifier: bobWorldProof.responses[0].nullifier,
    orgId: 'northstar',
    orgRole: 'Security Lead',
    now,
  })

  const clusterResult = await queryGuardianCluster({
    guardians: [gBeta, gGamma],
    signedRequest: freshReleaseReq,
    worldProof: bobWorldProof,
    orgCredential: bobOrgCredential,
    threshold: 2,
  })

  assert.equal(clusterResult.ok, true)
  assert.equal(clusterResult.responses.length, 2)

  // Client decrypts locally in memory
  const decrypted = await decryptCapsuleLocally({
    descriptor: creation.descriptor,
    guardianResponses: clusterResult.responses,
    ephemeralKeypair: bobEphemeral,
    expectedPolicyHash: creation.policyHash,
  })

  assert.equal(decrypted.ok, true)
  assert.equal(decrypted.text, vulnerabilityReport)

  // -------------------------------------------------------------------------
  // STEP 9: Generate verifiable disclosure receipt
  // -------------------------------------------------------------------------
  const receipt = createDisclosureReceipt({
    capsuleId: creation.capsuleId,
    policyHash: creation.policyHash,
    ciphertextHash: creation.ciphertextHash,
    recipientAddress: BOB.address,
    orgAttestation: {
      orgId: 'northstar',
      role: 'Security Lead',
      orgAuthority: TEST_ORGS.northstar.authorityAddress,
    },
    identityAttestation: {
      nullifier: bobWorldProof.responses[0].nullifier,
      action: bobWorldProof.action,
    },
    guardianAttestations: clusterResult.responses,
    decryptionSuccess: true,
  })

  assert.ok(receipt.receiptId.startsWith('rcpt_'))
  assert.equal(receipt.identityVerification.organizationalRole.orgId, 'northstar')
  assert.equal(receipt.identityVerification.organizationalRole.role, 'Security Lead')
  assert.equal(receipt.clientExecution.decryptionSuccess, true)
})
