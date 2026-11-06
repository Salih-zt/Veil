// VEIL Phase 5 Comprehensive Identity Verification & Recipient Authorization Test Suite
//
// Tests every security requirement, positive path, and adversarial refusal:
//   - World ID 4.0 proof validation & signal binding
//   - Enterprise organizational role credentials (PayCore, Cerberus)
//   - Recipient authorization request signing & ephemeral key binding
//   - Guardian multi-layer policy enforcement & anti-replay (nonces & nullifiers)
//   - End-to-end disclosure and decryption with threshold key shares

import { test, describe } from 'node:test'
import assert from 'node:assert/strict'
import { privateKeyToAccount, keccak256 } from '../../packages/guardian/guardian.mjs'

import {
  worldActionFor,
  worldSignalFor,
  hashSignal,
  generateMockWorldProof,
  verifyWorldProof,
} from '../../packages/crypto/identity/world-id.mjs'

import {
  issueOrgCredential,
  verifyOrgCredential,
  TEST_ORGS,
  DEFAULT_TRUSTED_AUTHORITIES,
} from '../../packages/crypto/identity/org-auth.mjs'

import {
  formatReleaseRequestMessageV2,
  signReleaseRequestV2,
  verifyReleaseRequestV2,
} from '../../packages/crypto/identity/recipient-auth.mjs'

import { retrieveAndOpenCapsule } from '../../packages/crypto/identity/recipient-flow.mjs'
import { createCapsule, openCapsule } from '../../packages/crypto/capsule.mjs'
import { createGuardianCore } from '../../packages/guardian/guardian.mjs'
import { genKeyPair, toHex } from '../../packages/crypto/keys.mjs'

// Deterministic test accounts
const ALICE_PRIVKEY = '0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80'
const BOB_PRIVKEY = '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
const MALLORY_PRIVKEY = '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'

const ALICE = privateKeyToAccount(ALICE_PRIVKEY)
const BOB = privateKeyToAccount(BOB_PRIVKEY)
const MALLORY = privateKeyToAccount(MALLORY_PRIVKEY)

describe('World ID 4.0 Proof Verification & Signal Binding', () => {
  const capsuleId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  const recipient = BOB.address
  const { pub: recipientPub } = genKeyPair()
  const pubHex = toHex(recipientPub)

  test('valid World ID 4.0 proof passes verification', async () => {
    const proof = generateMockWorldProof({ capsuleId, recipient, recipientPub: pubHex })
    const res = await verifyWorldProof(proof, { capsuleId, recipient, recipientPub: pubHex })

    assert.equal(res.ok, true)
    assert.equal(res.nullifier, proof.responses[0].nullifier.toLowerCase())
    assert.equal(res.action, worldActionFor(capsuleId))
  })

  test('rejects unsupported protocol version (e.g. 3.0)', async () => {
    const proof = generateMockWorldProof({ capsuleId, recipient, recipientPub: pubHex })
    proof.protocol_version = '3.0'

    const res = await verifyWorldProof(proof, { capsuleId, recipient, recipientPub: pubHex })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'UNSUPPORTED_PROTOCOL_VERSION')
  })

  test('rejects mismatched action (capsule-specific isolation)', async () => {
    const otherCapsule = '0x9999999999999999999999999999999999999999999999999999999999999999'
    const proof = generateMockWorldProof({ capsuleId: otherCapsule, recipient, recipientPub: pubHex })

    const res = await verifyWorldProof(proof, { capsuleId, recipient, recipientPub: pubHex })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'ACTION_MISMATCH')
  })

  test('rejects mismatched environment', async () => {
    const proof = generateMockWorldProof({ capsuleId, recipient, recipientPub: pubHex, environment: 'staging' })

    const res = await verifyWorldProof(proof, { capsuleId, recipient, recipientPub: pubHex, expectedEnv: 'production' })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'ENVIRONMENT_MISMATCH')
  })

  test('rejects wrong credential type', async () => {
    const proof = generateMockWorldProof({ capsuleId, recipient, recipientPub: pubHex, credential: 'selfie' })

    const res = await verifyWorldProof(proof, { capsuleId, recipient, recipientPub: pubHex, expectedCredential: 'proof_of_human' })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'CREDENTIAL_TYPE_MISMATCH')
  })

  test('rejects malformed Groth16 proof vector', async () => {
    const proof = generateMockWorldProof({ capsuleId, recipient, recipientPub: pubHex })
    proof.responses[0].proof = ['0x1', '0x2'] // only 2 points instead of 5

    const res = await verifyWorldProof(proof, { capsuleId, recipient, recipientPub: pubHex })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'MALFORMED_ZK_PROOF')
  })

  test('rejects missing or invalid nullifier', async () => {
    const proof = generateMockWorldProof({ capsuleId, recipient, recipientPub: pubHex })
    proof.responses[0].nullifier = ''

    const res = await verifyWorldProof(proof, { capsuleId, recipient, recipientPub: pubHex })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'INVALID_NULLIFIER')
  })

  test('rejects tampered recipient address (signal hash mismatch)', async () => {
    const proof = generateMockWorldProof({ capsuleId, recipient, recipientPub: pubHex })

    // Attacker presents Bob's proof for Mallory's address
    const res = await verifyWorldProof(proof, { capsuleId, recipient: MALLORY.address, recipientPub: pubHex })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'SIGNAL_HASH_MISMATCH')
  })

  test('rejects tampered ephemeral public key (MITM signal mismatch)', async () => {
    const proof = generateMockWorldProof({ capsuleId, recipient, recipientPub: pubHex })
    const { pub: malloryPub } = genKeyPair()

    // Attacker tries to substitute their ephemeral public key
    const res = await verifyWorldProof(proof, { capsuleId, recipient, recipientPub: toHex(malloryPub) })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'SIGNAL_HASH_MISMATCH')
  })

  test('rejects expired proof', async () => {
    // Expired 10 minutes ago
    const pastMinute = Math.floor(Date.now() / 60000) - 10
    const proof = generateMockWorldProof({ capsuleId, recipient, recipientPub: pubHex, expiresAtMin: pastMinute })

    const res = await verifyWorldProof(proof, { capsuleId, recipient, recipientPub: pubHex })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'PROOF_EXPIRED')
  })

  test('network verifier failure is propagated', async () => {
    const proof = generateMockWorldProof({ capsuleId, recipient, recipientPub: pubHex })
    const failingVerifier = async () => ({ ok: false, reason: 'World Chain verifier reverted: invalid ZK proof' })

    const res = await verifyWorldProof(proof, {
      capsuleId,
      recipient,
      recipientPub: pubHex,
      verifyNetwork: failingVerifier,
    })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'NETWORK_VERIFICATION_FAILED')
    assert.match(res.reason, /reverted/)
  })
})

describe('Organizational Role Authorization', () => {
  const recipient = BOB.address
  const capsuleId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'

  test('issue and verify valid PayCore Security Lead credential', async () => {
    const cred = await issueOrgCredential({
      orgId: 'paycore',
      authorityPrivateKey: TEST_ORGS.paycore.privateKey,
      recipient,
      role: 'Security Lead',
      capsuleScope: capsuleId,
    })

    const res = await verifyOrgCredential(cred, {
      expectedOrgId: 'paycore',
      expectedRole: 'Security Lead',
      expectedRecipient: recipient,
      expectedCapsuleId: capsuleId,
    })

    assert.equal(res.ok, true)
    assert.equal(res.orgId, 'paycore')
    assert.equal(res.role, 'Security Lead')
  })

  test('issue and verify valid Cerberus Key Custodian credential', async () => {
    const cred = await issueOrgCredential({
      orgId: 'cerberus',
      authorityPrivateKey: TEST_ORGS.cerberus.privateKey,
      recipient,
      role: 'Key Custodian',
      capsuleScope: '*', // Wildcard scope
    })

    const res = await verifyOrgCredential(cred, {
      expectedOrgId: 'cerberus',
      expectedRole: 'Key Custodian',
      expectedRecipient: recipient,
      expectedCapsuleId: capsuleId,
    })

    assert.equal(res.ok, true)
  })

  test('rejects mismatched organization ID', async () => {
    const cred = await issueOrgCredential({
      orgId: 'paycore',
      authorityPrivateKey: TEST_ORGS.paycore.privateKey,
      recipient,
      role: 'Security Lead',
    })

    const res = await verifyOrgCredential(cred, {
      expectedOrgId: 'cerberus',
      expectedRole: 'Security Lead',
      expectedRecipient: recipient,
    })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'ORG_MISMATCH')
  })

  test('rejects untrusted organization authority (foreign signer)', async () => {
    // Mallory pretends to sign a PayCore credential with their own key
    const cred = await issueOrgCredential({
      orgId: 'paycore',
      authorityPrivateKey: MALLORY_PRIVKEY,
      recipient,
      role: 'Security Lead',
    })

    const res = await verifyOrgCredential(cred, {
      expectedOrgId: 'paycore',
      expectedRole: 'Security Lead',
      expectedRecipient: recipient,
    })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'UNTRUSTED_AUTHORITY')
  })

  test('rejects recipient wallet mismatch', async () => {
    const cred = await issueOrgCredential({
      orgId: 'paycore',
      authorityPrivateKey: TEST_ORGS.paycore.privateKey,
      recipient: BOB.address,
      role: 'Security Lead',
    })

    // Mallory tries to present Bob's credential
    const res = await verifyOrgCredential(cred, {
      expectedOrgId: 'paycore',
      expectedRole: 'Security Lead',
      expectedRecipient: MALLORY.address,
    })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'RECIPIENT_MISMATCH')
  })

  test('rejects unauthorized role (privilege elevation defense)', async () => {
    const cred = await issueOrgCredential({
      orgId: 'paycore',
      authorityPrivateKey: TEST_ORGS.paycore.privateKey,
      recipient,
      role: 'Compliance Auditor', // Lower role
    })

    const res = await verifyOrgCredential(cred, {
      expectedOrgId: 'paycore',
      expectedRole: 'Security Lead', // Requires higher role
      expectedRecipient: recipient,
    })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'ROLE_MISMATCH')
  })

  test('rejects mismatched capsule scope', async () => {
    const cred = await issueOrgCredential({
      orgId: 'paycore',
      authorityPrivateKey: TEST_ORGS.paycore.privateKey,
      recipient,
      role: 'Security Lead',
      capsuleScope: '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa',
    })

    const res = await verifyOrgCredential(cred, {
      expectedOrgId: 'paycore',
      expectedRole: 'Security Lead',
      expectedRecipient: recipient,
      expectedCapsuleId: capsuleId,
    })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'CAPSULE_SCOPE_MISMATCH')
  })

  test('rejects expired organizational credential', async () => {
    const cred = await issueOrgCredential({
      orgId: 'paycore',
      authorityPrivateKey: TEST_ORGS.paycore.privateKey,
      recipient,
      role: 'Security Lead',
      issuedAt: Math.floor(Date.now() / 1000) - 7200,
      expiresAt: Math.floor(Date.now() / 1000) - 3600, // Expired 1 hour ago
    })

    const res = await verifyOrgCredential(cred, {
      expectedOrgId: 'paycore',
      expectedRole: 'Security Lead',
      expectedRecipient: recipient,
    })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'CREDENTIAL_EXPIRED')
  })

  test('rejects tampered credential payload', async () => {
    const cred = await issueOrgCredential({
      orgId: 'paycore',
      authorityPrivateKey: TEST_ORGS.paycore.privateKey,
      recipient,
      role: 'Compliance Auditor',
    })

    // Attacker modifies role without valid signature
    cred.role = 'Security Lead'

    const res = await verifyOrgCredential(cred, {
      expectedOrgId: 'paycore',
      expectedRole: 'Security Lead',
      expectedRecipient: recipient,
    })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'INVALID_SIGNATURE')
  })
})

describe('Recipient Authorization Request Signing (v2)', () => {
  const capsuleId = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef'
  const policyHash = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdefabcdef'
  const { pub: recipientPub } = genKeyPair()
  const pubHex = toHex(recipientPub)

  test('valid release request signature passes verification', async () => {
    const req = await signReleaseRequestV2({
      account: BOB,
      chainId: 31337,
      registryAddress: '0x1111111111111111111111111111111111111111',
      capsuleId,
      policyHash,
      recipientPub: pubHex,
      identityNullifier: '0x0001',
      orgId: 'paycore',
      orgRole: 'Security Lead',
    })

    const res = await verifyReleaseRequestV2({ request: req, signature: req.signature })
    assert.equal(res.ok, true)
    assert.equal(res.recipient, BOB.address.toLowerCase())
  })

  test('rejects expired request signature', async () => {
    const req = await signReleaseRequestV2({
      account: BOB,
      capsuleId,
      policyHash,
      recipientPub: pubHex,
      expiry: Date.now() - 1000, // Expired 1s ago
    })

    const res = await verifyReleaseRequestV2({ request: req, signature: req.signature })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'REQUEST_EXPIRED')
  })

  test('rejects request with excessive TTL', async () => {
    const req = await signReleaseRequestV2({
      account: BOB,
      capsuleId,
      policyHash,
      recipientPub: pubHex,
      expiry: Date.now() + 3600 * 1000, // 1 hour (exceeds 10m TTL)
    })

    const res = await verifyReleaseRequestV2({ request: req, signature: req.signature })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'TTL_EXCEEDED')
  })

  test('rejects tampered recipient ephemeral public key (MITM defense)', async () => {
    const req = await signReleaseRequestV2({
      account: BOB,
      capsuleId,
      policyHash,
      recipientPub: pubHex,
    })

    // Attacker modifies recipientPub in request
    const { pub: malloryPub } = genKeyPair()
    req.recipientPub = toHex(malloryPub)

    const res = await verifyReleaseRequestV2({ request: req, signature: req.signature })
    assert.equal(res.ok, false)
    assert.equal(res.error, 'INVALID_SIGNATURE')
  })
})

describe('Guardian Multi-Layer Enforcement & Replay Defense', () => {
  const secretText = 'TOP_SECRET_INCIDENT_REPORT'
  let guardian
  let capsuleData
  let worldProof
  let orgCred
  let recipientKeypair
  let recipientPubHex

  function setupScenario({
    unlockTimestamp = 0,
    expiryTimestamp = 0,
    threshold = 2,
    approvalCount = 2,
    revoked = false,
    authorizedRecipient = BOB.address,
    identityCommitment = '0x0000000000000000000000000000000000000000000000000000000000000000',
  } = {}) {
    // Create mock onchain registry client
    const mockRegistryClient = {
      async isReleaseReady(cId) {
        if (revoked) return false
        const nowSec = Math.floor(Date.now() / 1000)
        if (unlockTimestamp > nowSec) return false
        if (expiryTimestamp !== 0 && nowSec > expiryTimestamp) return false
        if (approvalCount < threshold) return false
        return true
      },
      async isReleaseReadyForRecipient(cId, rcpt) {
        const baseReady = await this.isReleaseReady(cId)
        if (!baseReady) return false
        if (rcpt.toLowerCase() !== authorizedRecipient.toLowerCase()) return false
        return true
      },
      async getRecipientIdentityCommitment(cId, rcpt) {
        return identityCommitment
      },
    }

    const g = createGuardianCore({
      guardianId: 'guardian-test',
      publicClient: {},
      registryAddress: '0x1234567890123456789012345678901234567890',
    })

    // Inject mock registry client
    // Note: guardian.mjs uses internal registryClient; we test with created guardian
    return { guardian: g, mockRegistry: mockRegistryClient }
  }

  test('valid World ID + Org auth release succeeds and delivers sealed share', async () => {
    const g = createGuardianCore({ guardianId: 'guardian-1' })
    recipientKeypair = genKeyPair()
    recipientPubHex = toHex(recipientKeypair.pub)

    capsuleData = await createCapsule({
      plaintext: secretText,
      policyHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      guardianPublicKeys: [g.pubKey],
    })

    // Deposit share with World ID and PayCore Security Lead requirements
    g.deposit({
      capsuleId: capsuleData.capsuleId,
      shareIndex: capsuleData.shares[0].index,
      sealedBox: capsuleData.shares[0].sealedBox,
      policyHash: capsuleData.policyHash,
      ciphertextHash: capsuleData.ciphertextHash,
      requirements: {
        requireWorldId: true,
        requiredOrg: 'paycore',
        requiredRole: 'Security Lead',
      },
    })

    worldProof = generateMockWorldProof({
      capsuleId: capsuleData.capsuleId,
      recipient: BOB.address,
      recipientPub: recipientPubHex,
    })

    orgCred = await issueOrgCredential({
      orgId: 'paycore',
      authorityPrivateKey: TEST_ORGS.paycore.privateKey,
      recipient: BOB.address,
      role: 'Security Lead',
      capsuleScope: capsuleData.capsuleId,
    })

    const signedReq = await signReleaseRequestV2({
      account: BOB,
      capsuleId: capsuleData.capsuleId,
      policyHash: capsuleData.policyHash,
      recipientPub: recipientPubHex,
      identityNullifier: worldProof.responses[0].nullifier,
      orgId: 'paycore',
      orgRole: 'Security Lead',
    })

    const res = await g.release({
      capsuleId: capsuleData.capsuleId,
      recipient: BOB.address,
      recipientPub: recipientPubHex,
      nonce: signedReq.nonce,
      expiry: signedReq.expiry,
      signature: signedReq.signature,
      worldProof,
      orgCredential: orgCred,
    })

    assert.equal(res.ok, true)
    assert.equal(res.shareIndex, 1)
    assert.ok(res.sealedShare)
  })

  test('invalid World ID proof is rejected', async () => {
    const g = createGuardianCore({ guardianId: 'guardian-1' })
    const { pub: pub } = genKeyPair()
    const pData = await createCapsule({
      plaintext: secretText,
      policyHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      guardianPublicKeys: [g.pubKey],
    })

    g.deposit({
      capsuleId: pData.capsuleId,
      shareIndex: 1,
      sealedBox: pData.shares[0].sealedBox,
      policyHash: pData.policyHash,
      ciphertextHash: pData.ciphertextHash,
      requirements: { requireWorldId: true },
    })

    // Corrupted proof: wrong credential
    const badProof = generateMockWorldProof({ capsuleId: pData.capsuleId, recipient: BOB.address, recipientPub: toHex(pub), credential: 'selfie' })
    const req = await signReleaseRequestV2({ account: BOB, capsuleId: pData.capsuleId, policyHash: pData.policyHash, recipientPub: toHex(pub), worldProof: badProof })

    await assert.rejects(
      () => g.release({
        capsuleId: pData.capsuleId,
        recipient: BOB.address,
        recipientPub: toHex(pub),
        nonce: req.nonce,
        expiry: req.expiry,
        signature: req.signature,
        worldProof: badProof,
      }),
      /World ID verification failed/
    )
  })

  test('replayed World ID nullifier is rejected on second attempt', async () => {
    const g = createGuardianCore({ guardianId: 'guardian-1' })
    const { pub } = genKeyPair()
    const pData = await createCapsule({
      plaintext: secretText,
      policyHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      guardianPublicKeys: [g.pubKey],
    })

    g.deposit({
      capsuleId: pData.capsuleId,
      shareIndex: 1,
      sealedBox: pData.shares[0].sealedBox,
      policyHash: pData.policyHash,
      ciphertextHash: pData.ciphertextHash,
      requirements: { requireWorldId: true },
    })

    const wProof = generateMockWorldProof({ capsuleId: pData.capsuleId, recipient: BOB.address, recipientPub: toHex(pub) })

    // First request succeeds
    const req1 = await signReleaseRequestV2({
      account: BOB,
      capsuleId: pData.capsuleId,
      policyHash: pData.policyHash,
      recipientPub: toHex(pub),
      identityNullifier: wProof.responses[0].nullifier,
    })

    const res1 = await g.release({
      capsuleId: pData.capsuleId,
      recipient: BOB.address,
      recipientPub: toHex(pub),
      nonce: req1.nonce,
      expiry: req1.expiry,
      signature: req1.signature,
      worldProof: wProof,
    })
    assert.equal(res1.ok, true)

    // Second request with fresh nonce but SAME nullifier fails
    const req2 = await signReleaseRequestV2({
      account: BOB,
      capsuleId: pData.capsuleId,
      policyHash: pData.policyHash,
      recipientPub: toHex(pub),
      identityNullifier: wProof.responses[0].nullifier,
    })

    await assert.rejects(
      () => g.release({
        capsuleId: pData.capsuleId,
        recipient: BOB.address,
        recipientPub: toHex(pub),
        nonce: req2.nonce,
        expiry: req2.expiry,
        signature: req2.signature,
        worldProof: wProof,
      }),
      /World ID proof nullifier has already been spent/
    )
  })

  test('expired World ID proof is rejected', async () => {
    const g = createGuardianCore({ guardianId: 'guardian-1' })
    const { pub } = genKeyPair()
    const pData = await createCapsule({
      plaintext: secretText,
      policyHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      guardianPublicKeys: [g.pubKey],
    })

    g.deposit({
      capsuleId: pData.capsuleId,
      shareIndex: 1,
      sealedBox: pData.shares[0].sealedBox,
      policyHash: pData.policyHash,
      ciphertextHash: pData.ciphertextHash,
      requirements: { requireWorldId: true },
    })

    const pastExpiry = Math.floor(Date.now() / 60000) - 30
    const expProof = generateMockWorldProof({
      capsuleId: pData.capsuleId,
      recipient: BOB.address,
      recipientPub: toHex(pub),
      expiresAtMin: pastExpiry,
    })

    const req = await signReleaseRequestV2({
      account: BOB,
      capsuleId: pData.capsuleId,
      policyHash: pData.policyHash,
      recipientPub: toHex(pub),
      worldProof: expProof,
    })

    await assert.rejects(
      () => g.release({
        capsuleId: pData.capsuleId,
        recipient: BOB.address,
        recipientPub: toHex(pub),
        nonce: req.nonce,
        expiry: req.expiry,
        signature: req.signature,
        worldProof: expProof,
      }),
      /World ID verification failed: Proof expired/
    )
  })

  test('missing organizational credential is rejected when required', async () => {
    const g = createGuardianCore({ guardianId: 'guardian-1' })
    const { pub } = genKeyPair()
    const pData = await createCapsule({
      plaintext: secretText,
      policyHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      guardianPublicKeys: [g.pubKey],
    })

    g.deposit({
      capsuleId: pData.capsuleId,
      shareIndex: 1,
      sealedBox: pData.shares[0].sealedBox,
      policyHash: pData.policyHash,
      ciphertextHash: pData.ciphertextHash,
      requirements: { requiredOrg: 'paycore', requiredRole: 'Security Lead' },
    })

    const req = await signReleaseRequestV2({
      account: BOB,
      capsuleId: pData.capsuleId,
      policyHash: pData.policyHash,
      recipientPub: toHex(pub),
      orgId: 'paycore',
      orgRole: 'Security Lead',
    })

    await assert.rejects(
      () => g.release({
        capsuleId: pData.capsuleId,
        recipient: BOB.address,
        recipientPub: toHex(pub),
        nonce: req.nonce,
        expiry: req.expiry,
        signature: req.signature,
        orgCredential: null, // Missing!
      }),
      /organizational role credential is required/
    )
  })

  test('wrong organizational role is rejected', async () => {
    const g = createGuardianCore({ guardianId: 'guardian-1' })
    const { pub } = genKeyPair()
    const pData = await createCapsule({
      plaintext: secretText,
      policyHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      guardianPublicKeys: [g.pubKey],
    })

    g.deposit({
      capsuleId: pData.capsuleId,
      shareIndex: 1,
      sealedBox: pData.shares[0].sealedBox,
      policyHash: pData.policyHash,
      ciphertextHash: pData.ciphertextHash,
      requirements: { requiredOrg: 'paycore', requiredRole: 'Security Lead' },
    })

    const badRoleCred = await issueOrgCredential({
      orgId: 'paycore',
      authorityPrivateKey: TEST_ORGS.paycore.privateKey,
      recipient: BOB.address,
      role: 'Compliance Auditor', // Wrong role
      capsuleScope: pData.capsuleId,
    })

    const req = await signReleaseRequestV2({
      account: BOB,
      capsuleId: pData.capsuleId,
      policyHash: pData.policyHash,
      recipientPub: toHex(pub),
      orgId: 'paycore',
      orgRole: 'Compliance Auditor',
    })

    await assert.rejects(
      () => g.release({
        capsuleId: pData.capsuleId,
        recipient: BOB.address,
        recipientPub: toHex(pub),
        nonce: req.nonce,
        expiry: req.expiry,
        signature: req.signature,
        orgCredential: badRoleCred,
      }),
      /Required role "Security Lead", but credential has "Compliance Auditor"/
    )
  })

  test('untrusted organization authority is rejected', async () => {
    const g = createGuardianCore({ guardianId: 'guardian-1' })
    const { pub } = genKeyPair()
    const pData = await createCapsule({
      plaintext: secretText,
      policyHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      guardianPublicKeys: [g.pubKey],
    })

    g.deposit({
      capsuleId: pData.capsuleId,
      shareIndex: 1,
      sealedBox: pData.shares[0].sealedBox,
      policyHash: pData.policyHash,
      ciphertextHash: pData.ciphertextHash,
      requirements: { requiredOrg: 'paycore', requiredRole: 'Security Lead' },
    })

    const rogueCred = await issueOrgCredential({
      orgId: 'paycore',
      authorityPrivateKey: MALLORY_PRIVKEY, // Mallory is not PayCore authority
      recipient: BOB.address,
      role: 'Security Lead',
      capsuleScope: pData.capsuleId,
    })

    const req = await signReleaseRequestV2({
      account: BOB,
      capsuleId: pData.capsuleId,
      policyHash: pData.policyHash,
      recipientPub: toHex(pub),
      orgCredential: rogueCred,
    })

    await assert.rejects(
      () => g.release({
        capsuleId: pData.capsuleId,
        recipient: BOB.address,
        recipientPub: toHex(pub),
        nonce: req.nonce,
        expiry: req.expiry,
        signature: req.signature,
        orgCredential: rogueCred,
      }),
      /Credential authority ".*" is not trusted for "paycore"/
    )
  })

  test('replayed recipient request nonce is rejected', async () => {
    const g = createGuardianCore({ guardianId: 'guardian-1' })
    const { pub } = genKeyPair()
    const pData = await createCapsule({
      plaintext: secretText,
      policyHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      guardianPublicKeys: [g.pubKey],
    })

    g.deposit({
      capsuleId: pData.capsuleId,
      shareIndex: 1,
      sealedBox: pData.shares[0].sealedBox,
      policyHash: pData.policyHash,
      ciphertextHash: pData.ciphertextHash,
    })

    const req = await signReleaseRequestV2({
      account: BOB,
      capsuleId: pData.capsuleId,
      policyHash: pData.policyHash,
      recipientPub: toHex(pub),
    })

    // First request succeeds
    const res1 = await g.release({
      capsuleId: pData.capsuleId,
      recipient: BOB.address,
      recipientPub: toHex(pub),
      nonce: req.nonce,
      expiry: req.expiry,
      signature: req.signature,
    })
    assert.equal(res1.ok, true)

    // Second request with SAME nonce fails
    await assert.rejects(
      () => g.release({
        capsuleId: pData.capsuleId,
        recipient: BOB.address,
        recipientPub: toHex(pub),
        nonce: req.nonce,
        expiry: req.expiry,
        signature: req.signature,
      }),
      /request nonce has already been used/
    )
  })

  test('unmet time condition rejected onchain even with valid identity proof', async () => {
    const mockClient = {
      readContract: async ({ functionName }) => {
        if (functionName === 'isReleaseReadyForRecipient') return false
        if (functionName === 'isReleaseReady') return false // Deadline not passed
        return null
      },
    }

    const regAddr = '0x1111111111111111111111111111111111111111'
    const g = createGuardianCore({
      guardianId: 'guardian-time-test',
      publicClient: mockClient,
      registryAddress: regAddr,
    })

    const { pub } = genKeyPair()
    const pData = await createCapsule({
      plaintext: secretText,
      policyHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      guardianPublicKeys: [g.pubKey],
    })

    g.deposit({
      capsuleId: pData.capsuleId,
      shareIndex: 1,
      sealedBox: pData.shares[0].sealedBox,
      policyHash: pData.policyHash,
      ciphertextHash: pData.ciphertextHash,
      requirements: { requireWorldId: true },
    })

    const wProof = generateMockWorldProof({ capsuleId: pData.capsuleId, recipient: BOB.address, recipientPub: toHex(pub) })
    const req = await signReleaseRequestV2({
      account: BOB,
      registryAddress: regAddr,
      capsuleId: pData.capsuleId,
      policyHash: pData.policyHash,
      recipientPub: toHex(pub),
      worldProof: wProof,
    })

    await assert.rejects(
      () => g.release({
        capsuleId: pData.capsuleId,
        recipient: BOB.address,
        recipientPub: toHex(pub),
        nonce: req.nonce,
        expiry: req.expiry,
        signature: req.signature,
        registryAddress: regAddr,
        worldProof: wProof,
      }),
      /onchain policy conditions not satisfied \(deadline not passed, insufficient approvals, or revoked\)/
    )
  })

  test('insufficient reviewer approvals rejected onchain even with valid identity proof', async () => {
    const regAddr = '0x1111111111111111111111111111111111111111'
    const mockClient = {
      readContract: async ({ functionName }) => {
        if (functionName === 'isReleaseReadyForRecipient') return false
        if (functionName === 'isReleaseReady') return false // Insufficient quorum
        return null
      },
    }

    const g = createGuardianCore({
      guardianId: 'guardian-quorum-test',
      publicClient: mockClient,
      registryAddress: regAddr,
    })

    const { pub } = genKeyPair()
    const pData = await createCapsule({
      plaintext: secretText,
      policyHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      guardianPublicKeys: [g.pubKey],
    })

    g.deposit({
      capsuleId: pData.capsuleId,
      shareIndex: 1,
      sealedBox: pData.shares[0].sealedBox,
      policyHash: pData.policyHash,
      ciphertextHash: pData.ciphertextHash,
      requirements: { requireWorldId: true },
    })

    const wProof = generateMockWorldProof({ capsuleId: pData.capsuleId, recipient: BOB.address, recipientPub: toHex(pub) })
    const req = await signReleaseRequestV2({
      account: BOB,
      registryAddress: regAddr,
      capsuleId: pData.capsuleId,
      policyHash: pData.policyHash,
      recipientPub: toHex(pub),
      worldProof: wProof,
    })

    await assert.rejects(
      () => g.release({
        capsuleId: pData.capsuleId,
        recipient: BOB.address,
        recipientPub: toHex(pub),
        nonce: req.nonce,
        expiry: req.expiry,
        signature: req.signature,
        registryAddress: regAddr,
        worldProof: wProof,
      }),
      /onchain policy conditions not satisfied/
    )
  })

  test('revoked or unauthorized recipient rejected onchain even with valid identity proof', async () => {
    const regAddr = '0x1111111111111111111111111111111111111111'
    const mockClient = {
      readContract: async ({ functionName }) => {
        if (functionName === 'isReleaseReady') return true // General conditions met
        if (functionName === 'isReleaseReadyForRecipient') return false // Recipient revoked or not authorized
        return null
      },
    }

    const g = createGuardianCore({
      guardianId: 'guardian-rcpt-test',
      publicClient: mockClient,
      registryAddress: regAddr,
    })

    const { pub } = genKeyPair()
    const pData = await createCapsule({
      plaintext: secretText,
      policyHash: '0x1111111111111111111111111111111111111111111111111111111111111111',
      guardianPublicKeys: [g.pubKey],
    })

    g.deposit({
      capsuleId: pData.capsuleId,
      shareIndex: 1,
      sealedBox: pData.shares[0].sealedBox,
      policyHash: pData.policyHash,
      ciphertextHash: pData.ciphertextHash,
      requirements: { requireWorldId: true },
    })

    const wProof = generateMockWorldProof({ capsuleId: pData.capsuleId, recipient: BOB.address, recipientPub: toHex(pub) })
    const req = await signReleaseRequestV2({
      account: BOB,
      registryAddress: regAddr,
      capsuleId: pData.capsuleId,
      policyHash: pData.policyHash,
      recipientPub: toHex(pub),
      worldProof: wProof,
    })

    await assert.rejects(
      () => g.release({
        capsuleId: pData.capsuleId,
        recipient: BOB.address,
        recipientPub: toHex(pub),
        nonce: req.nonce,
        expiry: req.expiry,
        signature: req.signature,
        registryAddress: regAddr,
        worldProof: wProof,
      }),
      /recipient is not authorized onchain for this capsule/
    )
  })
})

describe('End-to-End Disclosure Flow (retrieveAndOpenCapsule)', () => {
  test('Alice creates capsule, 3 guardians store shares, Bob with valid identity reveals secret', async () => {
    // 1. Initialize 3 independent guardians
    const gA = createGuardianCore({ guardianId: 'guardian-a' })
    const gB = createGuardianCore({ guardianId: 'guardian-b' })
    const gC = createGuardianCore({ guardianId: 'guardian-c' })

    const secret = 'CRITICAL_ZERO_DAY_DISCLOSURE_VULNERABILITY_FIX'

    // 2. Alice creates capsule sealed to 3 guardians
    const capsule = await createCapsule({
      plaintext: secret,
      policyHash: '0x3333333333333333333333333333333333333333333333333333333333333333',
      guardianPublicKeys: [gA.pubKey, gB.pubKey, gC.pubKey],
    })

    // 3. Deposit shares onto guardians with policy requirements
    const reqs = { requireWorldId: true, requiredOrg: 'paycore', requiredRole: 'Security Lead' }
    gA.deposit({
      capsuleId: capsule.capsuleId,
      shareIndex: capsule.shares[0].index,
      sealedBox: capsule.shares[0].sealedBox,
      policyHash: capsule.policyHash,
      ciphertextHash: capsule.ciphertextHash,
      requirements: reqs,
    })
    gB.deposit({
      capsuleId: capsule.capsuleId,
      shareIndex: capsule.shares[1].index,
      sealedBox: capsule.shares[1].sealedBox,
      policyHash: capsule.policyHash,
      ciphertextHash: capsule.ciphertextHash,
      requirements: reqs,
    })
    gC.deposit({
      capsuleId: capsule.capsuleId,
      shareIndex: capsule.shares[2].index,
      sealedBox: capsule.shares[2].sealedBox,
      policyHash: capsule.policyHash,
      ciphertextHash: capsule.ciphertextHash,
      requirements: reqs,
    })

    // 4. Bob prepares identity credentials
    // Note: generateMockWorldProof without recipientPub produces proof that will match Bob's dynamic ephemeral key
    // In retrieveAndOpenCapsule, we supply the org credential; World ID proof can be generated per ephemeral pub
    const orgCred = await issueOrgCredential({
      orgId: 'paycore',
      authorityPrivateKey: TEST_ORGS.paycore.privateKey,
      recipient: BOB.address,
      role: 'Security Lead',
      capsuleScope: capsule.capsuleId,
    })

    // 5. Bob executes retrieval flow with dynamic World ID proof generator and PayCore credential
    const revealResult = await retrieveAndOpenCapsule({
      descriptor: capsule.descriptor,
      account: BOB,
      guardians: [gA, gB, gC],
      worldProof: (params) => generateMockWorldProof(params),
      orgCredential: orgCred,
    })

    assert.equal(revealResult.ok, true)
    assert.equal(revealResult.text, secret)
    assert.equal(revealResult.shareCount, 3)
  })

  test('fails closed if an unauthorized attacker (Mallory) attempts retrieval', async () => {
    const gA = createGuardianCore({ guardianId: 'guardian-a' })
    const gB = createGuardianCore({ guardianId: 'guardian-b' })
    const gC = createGuardianCore({ guardianId: 'guardian-c' })

    const capsule = await createCapsule({
      plaintext: 'SECRET',
      policyHash: '0x4444444444444444444444444444444444444444444444444444444444444444',
      guardianPublicKeys: [gA.pubKey, gB.pubKey, gC.pubKey],
    })

    const reqs = { requiredOrg: 'paycore', requiredRole: 'Security Lead' }
    gA.deposit({ capsuleId: capsule.capsuleId, shareIndex: 1, sealedBox: capsule.shares[0].sealedBox, policyHash: capsule.policyHash, ciphertextHash: capsule.ciphertextHash, requirements: reqs })
    gB.deposit({ capsuleId: capsule.capsuleId, shareIndex: 2, sealedBox: capsule.shares[1].sealedBox, policyHash: capsule.policyHash, ciphertextHash: capsule.ciphertextHash, requirements: reqs })
    gC.deposit({ capsuleId: capsule.capsuleId, shareIndex: 3, sealedBox: capsule.shares[2].sealedBox, policyHash: capsule.policyHash, ciphertextHash: capsule.ciphertextHash, requirements: reqs })

    // Mallory tries to retrieve without a valid PayCore credential
    const revealResult = await retrieveAndOpenCapsule({
      descriptor: capsule.descriptor,
      account: MALLORY,
      guardians: [gA, gB, gC],
    })

    assert.equal(revealResult.ok, false)
    assert.equal(revealResult.error, 'INSUFFICIENT_SHARES')
  })
})
