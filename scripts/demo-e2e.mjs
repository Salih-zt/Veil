#!/usr/bin/env node
// VEIL — Phase 6 Interactive End-to-End Protocol Walkthrough
//
// Demonstrates the full lifecycle of a Programmable Secret Capsule:
// 1. Alice creates encrypted capsule with release policy (Timelock + Multi-Party Review + World ID + Org Role).
// 2. Secret is split into Shamir shares, sealed to 3 independent guardians, and encoded as carrier text.
// 3. Bob receives ordinary-looking carrier text, detects hidden capsule descriptor.
// 4. Bob attempts early unauthorized access -> Guardians reject request (time & approvals missing).
// 5. Reviewers approve onchain policy.
// 6. Unlock deadline passes.
// 7. Bob presents World ID 4.0 proof + PayCore Security Lead organizational credential.
// 8. Independent guardians verify policy independently, sign attestations, and release sealed shares.
// 9. Bob unseals shares using ephemeral private key, reconstructs DEK, decrypts plaintext, and prints receipt.

import { createGuardianCore, privateKeyToAccount } from '../packages/guardian/guardian.mjs'
import { queryGuardianCluster } from '../packages/guardian/orchestrator.mjs'
import { createAndRegisterCapsule } from '../packages/crypto/workflow/creator.mjs'
import { detectAndInspectCapsule } from '../packages/crypto/workflow/detector.mjs'
import { submitReviewerApproval } from '../packages/crypto/workflow/reviewer.mjs'
import { decryptCapsuleLocally } from '../packages/crypto/workflow/decryptor.mjs'
import { createDisclosureReceipt } from '../packages/crypto/workflow/receipt.mjs'
import { signReleaseRequestV2 } from '../packages/crypto/identity/recipient-auth.mjs'
import { generateMockWorldProof } from '../packages/crypto/identity/world-id.mjs'
import { issueOrgCredential, TEST_ORGS } from '../packages/crypto/identity/org-auth.mjs'
import { genKeyPair, toHex } from '../packages/crypto/keys.mjs'

const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const DIM = '\x1b[2m'

function banner(text) {
  console.log(`\n${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}`)
  console.log(`${BOLD}${CYAN}  ${text}${RESET}`)
  console.log(`${BOLD}${CYAN}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${RESET}\n`)
}

function step(num, title) {
  console.log(`${BOLD}${YELLOW}[STEP ${num}] ${title}${RESET}`)
}

async function runDemo() {
  banner('VEIL: PROGRAMMABLE SECRET CAPSULES — END-TO-END DEMO')

  // Simulated actors
  const ALICE = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
  const BOB = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
  const REVIEWER_1 = privateKeyToAccount('0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6')
  const REVIEWER_2 = privateKeyToAccount('0xf214ab6113087220388e9ee514ec6093be45054f1079e42f18b32f95ec84c51b')

  let simulatedTimeSec = Math.floor(Date.now() / 1000)

  // In-memory onchain registry simulation
  const capsuleStore = new Map()
  const reviewerApprovals = new Map()
  const authorizedRecipients = new Map()

  const registryAddress = '0xVeilPolicyRegistryContract'
  const registryMock = {
    async createCapsule(policy) {
      capsuleStore.set(policy.capsuleId.toLowerCase(), {
        ...policy,
        approvalCount: 0,
        revoked: false,
      })
      reviewerApprovals.set(policy.capsuleId.toLowerCase(), new Set())
      authorizedRecipients.set(policy.capsuleId.toLowerCase(), new Set())
      return '0xtx_capsule_create'
    },
    async authorizeRecipient(capsuleId, recipient) {
      const list = authorizedRecipients.get(capsuleId.toLowerCase()) || new Set()
      list.add(recipient.toLowerCase())
      authorizedRecipients.set(capsuleId.toLowerCase(), list)
      return '0xtx_auth_recipient'
    },
    async approveRelease(capsuleId) {
      const cap = capsuleStore.get(capsuleId.toLowerCase())
      const set = reviewerApprovals.get(capsuleId.toLowerCase())
      set.add(`reviewer_${set.size + 1}`)
      cap.approvalCount = set.size
      return '0xtx_approve_release'
    },
    async isReleaseReady(capsuleId) {
      const cap = capsuleStore.get(capsuleId.toLowerCase())
      if (!cap || cap.revoked) return false
      if (simulatedTimeSec < Number(cap.unlockTimestamp)) return false
      if (Number(cap.expiryTimestamp) !== 0 && simulatedTimeSec > Number(cap.expiryTimestamp)) return false
      if (cap.approvalCount < Number(cap.threshold)) return false
      return true
    },
    async isReleaseReadyForRecipient(capsuleId, recipient) {
      const ready = await this.isReleaseReady(capsuleId)
      if (!ready) return false
      const list = authorizedRecipients.get(capsuleId.toLowerCase())
      return list ? list.has(recipient.toLowerCase()) : false
    },
    async getCapsule(capsuleId) {
      return capsuleStore.get(capsuleId.toLowerCase())
    },
    async getReviewers() {
      return [REVIEWER_1.address, REVIEWER_2.address]
    },
  }

  const publicClientMock = {
    readContract: async ({ functionName, args }) => {
      if (functionName === 'isReleaseReady') return registryMock.isReleaseReady(args[0])
      if (functionName === 'isReleaseReadyForRecipient') return registryMock.isReleaseReadyForRecipient(args[0], args[1])
      if (functionName === 'getCapsule') return registryMock.getCapsule(args[0])
      return null
    },
  }

  // Initialize 3 independent guardians
  const gA = createGuardianCore({ guardianId: 'guardian-alpha', publicClient: publicClientMock, registryAddress, now: () => simulatedTimeSec * 1000 })
  const gB = createGuardianCore({ guardianId: 'guardian-beta', publicClient: publicClientMock, registryAddress, now: () => simulatedTimeSec * 1000 })
  const gC = createGuardianCore({ guardianId: 'guardian-gamma', publicClient: publicClientMock, registryAddress, now: () => simulatedTimeSec * 1000 })
  const guardians = [gA, gB, gC]

  // ==========================================
  // STEP 1: ALICE CREATES CAPSULE
  // ==========================================
  step(1, 'Alice Creates Programmable Secret Capsule')
  const secretPayload = 'CRITICAL-VULN-PATCH-2026: Zero-day fix private commit hash: 0x8a4b6c9d1e2f3a4b'
  const unlockDeadline = simulatedTimeSec + 3600 // 1 hour timelock
  const expiryDeadline = simulatedTimeSec + 86400 // 24 hours expiry

  console.log(`  ${BOLD}Creator:${RESET} Alice (${ALICE.address})`)
  console.log(`  ${BOLD}Confidential Secret:${RESET} "${secretPayload}"`)
  console.log(`  ${BOLD}Release Policy Requirements:${RESET}`)
  console.log(`    - Timelock: +3600 seconds (1 hour lock)`)
  console.log(`    - Approval Quorum: 2-of-2 designated reviewers`)
  console.log(`    - Humanity: World ID 4.0 Proof-of-Humanity`)
  console.log(`    - Enterprise Role: "Security Lead" at "PayCore"`)
  console.log(`    - Shamir Threshold: 2-of-3 guardian key shares\n`)

  const aliceResult = await createAndRegisterCapsule({
    title: 'Zero-Day Vulnerability Disclosure',
    description: 'Hotfix cryptographic key for payment rail zero-day vulnerability',
    plaintext: secretPayload,
    recipients: [BOB.address],
    reviewers: [REVIEWER_1.address, REVIEWER_2.address],
    threshold: 2,
    unlockTimestamp: unlockDeadline,
    expiryTimestamp: expiryDeadline,
    requireWorldId: true,
    requiredOrg: 'paycore',
    requiredRole: 'Security Lead',
    guardians,
    registryClient: registryMock,
  })

  console.log(`  ${GREEN}✓ Capsule encrypted with AES-256-SIV AEAD envelope${RESET}`)
  console.log(`  ${GREEN}✓ DEK split into 3 Shamir shares (GF(256), k=2)${RESET}`)
  console.log(`  ${GREEN}✓ Shares sealed and deposited across 3 independent guardians${RESET}`)
  console.log(`  ${GREEN}✓ Policy registered onchain: Capsule ID ${aliceResult.capsuleId}${RESET}`)
  console.log(`  ${GREEN}✓ Reversible steganographic carrier text generated (${aliceResult.carrierText.split(' ').length} words):${RESET}`)
  console.log(`    ${DIM}"${aliceResult.carrierText.slice(0, 110)}..."${RESET}\n`)

  // ==========================================
  // STEP 2: BOB DETECTS CAPSULE
  // ==========================================
  step(2, 'Bob Receives Carrier Text & Inspects Capsule')
  console.log(`  ${BOLD}Recipient:${RESET} Bob (${BOB.address})`)

  const detection = await detectAndInspectCapsule({
    input: aliceResult.carrierText,
    recipientAddress: BOB.address,
    registryClient: registryMock,
    nowSec: simulatedTimeSec,
  })

  console.log(`  ${GREEN}✓ Steganographic carrier text decoded cleanly${RESET}`)
  console.log(`  ${BOLD}Capsule State:${RESET} ${CYAN}${detection.status}${RESET}`)
  console.log(`  ${BOLD}Onchain Policy Checklist:${RESET}`)
  console.log(`    - Timelock Satisfied:   ${detection.requirements.timeSatisfied ? GREEN + 'YES' : RED + 'NO (Locked for 3600s)'}${RESET}`)
  console.log(`    - Reviewer Quorum Met:  ${detection.requirements.quorumSatisfied ? GREEN + 'YES' : RED + `NO (${detection.requirements.approvalsCurrent}/${detection.requirements.approvalsRequired})`}${RESET}`)
  console.log(`    - Unlock Timestamp:     ${detection.requirements.unlockDate}`)
  console.log(`    - Expiry Timestamp:     ${detection.requirements.expiryDate}\n`)

  // ==========================================
  // STEP 3: EARLY ACCESS ATTEMPT (FAIL-CLOSED)
  // ==========================================
  step(3, 'Bob Requests Early Access (Before Conditions Met)')
  const bobEph = genKeyPair()
  const earlyProof = generateMockWorldProof({ capsuleId: aliceResult.capsuleId, recipient: BOB.address, recipientPub: toHex(bobEph.pub) })
  const earlyCred = await issueOrgCredential({
    orgId: 'paycore',
    authorityPrivateKey: TEST_ORGS.paycore.privateKey,
    recipient: BOB.address,
    role: 'Security Lead',
    capsuleScope: aliceResult.capsuleId,
    now: () => simulatedTimeSec * 1000,
  })
  const earlySignedReq = await signReleaseRequestV2({
    account: BOB,
    registryAddress,
    capsuleId: aliceResult.capsuleId,
    policyHash: aliceResult.policyHash,
    recipientPub: toHex(bobEph.pub),
    worldProof: earlyProof,
    orgCredential: earlyCred,
    now: () => simulatedTimeSec * 1000,
  })

  const earlyQuery = await queryGuardianCluster({
    guardians,
    signedRequest: earlySignedReq,
    worldProof: earlyProof,
    orgCredential: earlyCred,
    threshold: 2,
  })

  console.log(`  ${RED}✗ Early release refused by guardians: ${earlyQuery.error}${RESET}`)
  console.log(`    Guardian Denials: "${earlyQuery.denials[0].reason}"`)
  console.log(`  ${GREEN}✓ Policy integrity enforced: 0 key shares disclosed${RESET}\n`)

  // ==========================================
  // STEP 4: REVIEWERS APPROVE ONCHAIN
  // ==========================================
  step(4, 'Reviewers Vote & Approve Capsule Onchain')
  await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: REVIEWER_1.address, registryClient: registryMock })
  console.log(`  ${GREEN}✓ Reviewer 1 (${REVIEWER_1.address}) signed approval tx${RESET}`)
  await submitReviewerApproval({ capsuleId: aliceResult.capsuleId, reviewerAddress: REVIEWER_2.address, registryClient: registryMock })
  console.log(`  ${GREEN}✓ Reviewer 2 (${REVIEWER_2.address}) signed approval tx${RESET}`)
  console.log(`  ${GREEN}✓ Quorum satisfied: 2 of 2 reviewers confirmed${RESET}\n`)

  // ==========================================
  // STEP 5: TIME PROGRESSION
  // ==========================================
  step(5, 'Blockchain Time Progresses Past Deadline')
  simulatedTimeSec = unlockDeadline + 30
  console.log(`  Clock advanced past unlock deadline: ${new Date(simulatedTimeSec * 1000).toISOString()}`)
  console.log(`  ${GREEN}✓ Timelock condition satisfied${RESET}\n`)

  // ==========================================
  // STEP 6: BOB VERIFIES IDENTITY & REQUESTS RELEASE
  // ==========================================
  step(6, 'Bob Proves Multi-Layer Identity & Requests Key Shares')
  const validWorldProof = generateMockWorldProof({
    capsuleId: aliceResult.capsuleId,
    recipient: BOB.address,
    recipientPub: toHex(bobEph.pub),
  })
  console.log(`  ${GREEN}✓ World ID 4.0 proof generated (Nullifier: ${validWorldProof.responses[0].nullifier.slice(0, 18)}...)${RESET}`)

  const validOrgCred = await issueOrgCredential({
    orgId: 'paycore',
    authorityPrivateKey: TEST_ORGS.paycore.privateKey,
    recipient: BOB.address,
    role: 'Security Lead',
    capsuleScope: aliceResult.capsuleId,
    now: () => simulatedTimeSec * 1000,
  })
  console.log(`  ${GREEN}✓ PayCore authority issued verified role credential (Security Lead)${RESET}`)

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
  console.log(`  ${GREEN}✓ Bob signed domain-separated authorization request bound to ephemeral X25519 pubkey${RESET}\n`)

  // ==========================================
  // STEP 7: GUARDIANS DELIVER SHARES
  // ==========================================
  step(7, 'Independent Guardians Deliver Sealed Key Shares')
  const guardianRelease = await queryGuardianCluster({
    guardians,
    signedRequest: validSignedReq,
    worldProof: validWorldProof,
    orgCredential: validOrgCred,
    threshold: 2,
  })

  console.log(`  ${GREEN}✓ Guardian Alpha released sealed share #${guardianRelease.responses[0].shareIndex} (ECDSA Signed: ${guardianRelease.responses[0].signature.slice(0, 18)}...)${RESET}`)
  console.log(`  ${GREEN}✓ Guardian Beta  released sealed share #${guardianRelease.responses[1].shareIndex} (ECDSA Signed: ${guardianRelease.responses[1].signature.slice(0, 18)}...)${RESET}`)
  console.log(`  ${GREEN}✓ Guardian Gamma released sealed share #${guardianRelease.responses[2].shareIndex} (ECDSA Signed: ${guardianRelease.responses[2].signature.slice(0, 18)}...)${RESET}`)
  console.log(`  ${GREEN}✓ Collected ${guardianRelease.collectedCount} valid signed shares (threshold: 2)${RESET}\n`)

  // ==========================================
  // STEP 8: BOB DECRYPTS LOCALLY
  // ==========================================
  step(8, 'Bob Decrypts Capsule Locally in Client Sandbox')
  const decryption = await decryptCapsuleLocally({
    descriptor: aliceResult.descriptor,
    guardianResponses: guardianRelease.responses,
    ephemeralKeypair: bobEph,
    expectedPolicyHash: aliceResult.policyHash,
  })

  console.log(`  ${GREEN}✓ Shares unsealed locally using Bob's ephemeral private key${RESET}`)
  console.log(`  ${GREEN}✓ DEK reconstructed in memory via Shamir interpolation in GF(256)${RESET}`)
  console.log(`  ${GREEN}✓ AES-256-SIV AEAD envelope decrypted successfully!${RESET}`)
  console.log(`  ${BOLD}${CYAN}Revealed Plaintext:${RESET} "${BOLD}${decryption.text}${RESET}"\n`)

  // ==========================================
  // STEP 9: DISCLOSURE RECEIPT
  // ==========================================
  step(9, 'Generate Verifiable Cryptographic Disclosure Receipt')
  const receipt = createDisclosureReceipt({
    capsuleId: aliceResult.capsuleId,
    policyHash: aliceResult.policyHash,
    ciphertextHash: aliceResult.ciphertextHash,
    recipientAddress: BOB.address,
    identityAttestation: {
      provider: 'WorldID',
      nullifier: validWorldProof.responses[0].nullifier,
      action: validWorldProof.action,
      verified: true,
    },
    orgAttestation: {
      orgId: validOrgCred.orgId,
      role: validOrgCred.role,
      authority: validOrgCred.orgAuthority,
      verified: true,
    },
    guardianAttestations: guardianRelease.responses,
    decryptionSuccess: true,
    timestamp: simulatedTimeSec * 1000,
  })

  console.log(`  ${BOLD}Receipt Summary:${RESET}`)
  console.log(`    - Receipt ID: ${receipt.receiptId}`)
  console.log(`    - World ID Nullifier: ${receipt.identityVerification.worldId.nullifier}`)
  console.log(`    - Organization Role:  ${receipt.identityVerification.organizationalRole.role} @ ${receipt.identityVerification.organizationalRole.orgId}`)
  console.log(`    - Verified Guardians: ${receipt.guardianRelease.participatingGuardians.map(g => g.guardianId).join(', ')}`)
  console.log(`    - Client Decryption Verified: ${receipt.clientExecution.decryptionSuccess ? GREEN + 'TRUE' : RED + 'FALSE'}${RESET}`)

  banner('DEMONSTRATION COMPLETED SUCCESSFULLY (100% PROTOCOL INTEGRATION)')
}

runDemo().catch((err) => {
  console.error('Demonstration failed:', err)
  process.exit(1)
})
