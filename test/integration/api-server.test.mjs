// VEIL Protocol REST API — Unit & Endpoint Tests

import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { startApiServer } from '../../apps/api/server.mjs'
import { VeilClient } from '../../packages/sdk/src/client.ts'
import { MemoryStorageAdapter } from '../../packages/sdk/src/adapters/storage.ts'
import { DirectGuardianAdapter } from '../../packages/sdk/src/adapters/guardian.ts'
import { ViemAccountWalletAdapter } from '../../packages/sdk/src/adapters/wallet.ts'
import { createGuardianCore, privateKeyToAccount } from '../../packages/guardian/guardian.mjs'

describe('VEIL REST API (services/api/server.mjs) Endpoints', () => {
  const ALICE_ACCOUNT = privateKeyToAccount('0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80')
  const BOB_ACCOUNT = privateKeyToAccount('0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d')
  const REVIEWER_1 = privateKeyToAccount('0x2a871d0798f97d79848a013d4936a73bf4cc922c825d33c1cf7073dff6d409c6')

  const capsuleDb = new Map()
  const reviewerApprovals = new Map()
  const authorizedRecipients = new Map()
  const registryAddress = '0x1111111111111111111111111111111111111111'

  const mockRegistry = {
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
    async isReleaseReady(cId) {
      const cap = capsuleDb.get(cId.toLowerCase())
      return cap && !cap.revoked && cap.approvalCount >= Number(cap.threshold)
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
      return [REVIEWER_1.address]
    },
  }

  const publicClientMock = {
    readContract: async ({ functionName, args }) => {
      if (functionName === 'isReleaseReady') return mockRegistry.isReleaseReady(args[0])
      if (functionName === 'isReleaseReadyForRecipient') return mockRegistry.isReleaseReadyForRecipient(args[0], args[1])
      if (functionName === 'getCapsule') return mockRegistry.getCapsule(args[0])
      return null
    },
  }

  const gA = createGuardianCore({ guardianId: 'g-alpha', publicClient: publicClientMock, registryAddress })
  const gB = createGuardianCore({ guardianId: 'g-beta', publicClient: publicClientMock, registryAddress })
  const guardians = [new DirectGuardianAdapter(gA), new DirectGuardianAdapter(gB)]
  const storage = new MemoryStorageAdapter()

  const client = new VeilClient({
    registryAddress,
    publicClient: mockRegistry,
    guardians,
    storage,
    defaultWallet: new ViemAccountWalletAdapter(ALICE_ACCOUNT),
  })

  it('runs REST API, validates routes, rejects raw DEKs, and serves capsule status', async () => {
    const api = startApiServer({ port: 8991, client })
    await api.listen()

    try {
      // 1. GET /health
      const health = await fetch('http://localhost:8991/health').then(r => r.json())
      assert.equal(health.ok, true)
      assert.equal(health.service, 'veil-rest-api')

      // 2. Security Invariant: POST /api/v1/capsules rejects raw DEKs
      const rejectRes = await fetch('http://localhost:8991/api/v1/capsules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          content: 'secret',
          rawDek: '0x12345678', // Illegal parameter
          policy: { threshold: 2, reviewers: [REVIEWER_1.address], unlockAt: 100 },
        }),
      })
      assert.equal(rejectRes.status, 400)
      const rejectData = await rejectRes.json()
      assert.equal(rejectData.error, 'SECURITY_VIOLATION')

      // 3. POST /api/v1/capsules succeeds with valid policy
      const createRes = await fetch('http://localhost:8991/api/v1/capsules', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: 'Advisory Capsule',
          content: 'CONFIDENTIAL_PAYLOAD',
          policy: {
            unlockAt: Math.floor(Date.now() / 1000) - 10,
            threshold: 1,
            reviewers: [REVIEWER_1.address],
          },
          recipients: [BOB_ACCOUNT.address],
        }),
      })
      assert.equal(createRes.status, 201)
      const createData = await createRes.json()
      assert.equal(createData.ok, true)
      assert.ok(createData.capsuleId)
      assert.ok(createData.carrierText)

      const capsuleId = createData.capsuleId

      // 4. GET /api/v1/capsules/:id returns onchain state
      const getRes = await fetch(`http://localhost:8991/api/v1/capsules/${capsuleId}`)
      assert.equal(getRes.status, 200)
      const getData = await getRes.json()
      assert.equal(getData.ok, true)
      assert.equal(getData.capsule.capsuleId.toLowerCase(), capsuleId.toLowerCase())

      // 5. POST /api/v1/capsules/:id/approvals
      const approveRes = await fetch(`http://localhost:8991/api/v1/capsules/${capsuleId}/approvals`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signer: new ViemAccountWalletAdapter(REVIEWER_1),
        }),
      })
      assert.equal(approveRes.status, 200)
      const approveData = await approveRes.json()
      assert.equal(approveData.ok, true)

      // 6. GET /api/v1/capsules/:id/receipt
      const receiptRes = await fetch(`http://localhost:8991/api/v1/capsules/${capsuleId}/receipt`)
      assert.equal(receiptRes.status, 200)
      const receiptData = await receiptRes.json()
      assert.equal(receiptData.ok, true)
      assert.ok(receiptData.receipt.receiptId)
    } finally {
      await api.close()
    }
  })
})
