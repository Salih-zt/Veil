// VEIL Protocol — REST API Server with Human-Operated Demo Extensions
//
// Provides standardized REST API endpoints for external applications and the
// human-operated ETHGlobal judge demonstration (Northstar Payments scenario).
//
// Invariants:
//   - Zero plaintext: The server NEVER accepts or stores plaintext secrets or DEKs.
//   - Zero decryption: The server NEVER reconstructs DEKs or returns decrypted secrets.
//   - Zero raw shares: Key shares remain sealed to guardian or recipient public keys.
//   - Client-side final decryption: The client performs local unsealing, reconstruction, and decryption.

import { createServer } from 'node:http'
import { verifyMessage } from 'viem'
import { VeilClient } from '../../packages/sdk/src/client.ts'
import { MemoryStorageAdapter } from '../../packages/sdk/src/adapters/storage.ts'
import { DirectGuardianAdapter } from '../../packages/sdk/src/adapters/guardian.ts'
import { generateMockWorldProof } from '../../packages/crypto/identity/world-id.mjs'
import { issueOrgCredential, TEST_ORGS } from '../../packages/crypto/identity/org-auth.mjs'

export const DEMO_PARTICIPANTS = {
  alice: {
    name: 'Alice',
    role: 'Security Researcher',
    organization: 'Independent AppSec',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    description: 'Discovers the vulnerability and authors the confidential capsule',
  },
  bob: {
    name: 'Bob',
    role: 'Security Lead',
    organization: 'Northstar Payments',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    description: 'Designated authorized recipient for Northstar vulnerability disclosures',
  },
  charlie: {
    name: 'Charlie',
    role: 'AppSec Reviewer',
    organization: 'Northstar Advisory',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    description: 'Designated multi-party reviewer 1 (signs release approval tx)',
  },
  david: {
    name: 'David',
    role: 'Cryptographer Reviewer',
    organization: 'Northstar Payments',
    address: '0x35B33Ae737809aa6B03fe4124B760E14e5d996a0',
    description: 'Designated multi-party reviewer 2 (signs release approval tx)',
  },
  eve: {
    name: 'Eve',
    role: 'External Auditor',
    organization: 'Cerberus Audits',
    address: '0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc',
    description: 'Designated multi-party reviewer 3 (quorum threshold is 2 of 3)',
  },
}

export function startApiServer({
  port = 8088,
  client,
  apiKey = null,
  rateLimitWindowMs = 60000,
  maxRequestsPerWindow = 120,
} = {}) {
  // Simple in-memory sliding rate limiter
  const requestCounts = new Map()
  const activeChallenges = new Map() // address -> { nonce, issuedAt }

  function checkRateLimit(ip) {
    const now = Date.now()
    const record = requestCounts.get(ip) || { count: 0, resetAt: now + rateLimitWindowMs }
    if (now > record.resetAt) {
      record.count = 1
      record.resetAt = now + rateLimitWindowMs
    } else {
      record.count++
    }
    requestCounts.set(ip, record)
    return record.count <= maxRequestsPerWindow
  }

  function sendJson(res, statusCode, body) {
    const payload = JSON.stringify(body)
    res.writeHead(statusCode, {
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(payload),
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    })
    res.end(payload)
  }

  const server = createServer(async (req, res) => {
    const clientIp = req.socket.remoteAddress || 'unknown'

    // Rate limiting
    if (!checkRateLimit(clientIp)) {
      return sendJson(res, 429, { ok: false, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' })
    }

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      })
      return res.end()
    }

    // Optional API key authorization
    if (apiKey) {
      const headerKey = req.headers['x-api-key'] || req.headers['authorization']?.replace(/^Bearer /, '')
      if (headerKey !== apiKey) {
        return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED', message: 'Valid API key required' })
      }
    }

    const urlObj = new URL(req.url || '/', 'http://localhost')
    const pathname = urlObj.pathname

    // Health check
    if (req.method === 'GET' && pathname === '/health') {
      return sendJson(res, 200, {
        ok: true,
        service: 'veil-rest-api',
        version: '1.0.0',
        chainId: client?.chainId,
        registryAddress: client?.registryAddress,
      })
    }

    // Body parser helper
    async function getJsonBody() {
      return new Promise((resolve, reject) => {
        let data = ''
        req.on('data', (chunk) => {
          data += chunk
          if (data.length > 5 * 1024 * 1024) { // 5MB limit
            req.destroy()
            reject(new Error('Payload too large'))
          }
        })
        req.on('end', () => {
          try {
            resolve(data ? JSON.parse(data) : {})
          } catch {
            reject(new Error('Invalid JSON payload'))
          }
        })
        req.on('error', reject)
      })
    }

    try {
      // -----------------------------------------------------------------------
      // DEMO AUTHENTICATION & PARTICIPANTS ENDPOINTS
      // -----------------------------------------------------------------------

      // GET /api/v1/demo/participants — Retrieve authorized demo participants
      if (req.method === 'GET' && pathname === '/api/v1/demo/participants') {
        return sendJson(res, 200, {
          ok: true,
          company: 'Northstar Payments',
          scenario: 'Vulnerability Disclosure & Coordinated Embargo (CVE-2026-8812)',
          participants: DEMO_PARTICIPANTS,
        })
      }

      // POST /api/v1/auth/challenge — Generate SIWE-style challenge for wallet
      if (req.method === 'POST' && pathname === '/api/v1/auth/challenge') {
        const body = await getJsonBody()
        if (!body.address) {
          return sendJson(res, 400, { ok: false, error: 'MISSING_ADDRESS', message: 'address is required' })
        }
        const address = body.address.toLowerCase()
        const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')
        const issuedAt = new Date().toISOString()
        const message = [
          'veil.protocol wants you to sign in with your Ethereum account:',
          body.address,
          '',
          'Sign in to VEIL Protocol Demo Workspace (Northstar Payments)',
          '',
          'URI: http://localhost:3000',
          'Version: 1',
          `Chain ID: ${client?.chainId || 31337}`,
          `Nonce: ${nonce}`,
          `Issued At: ${issuedAt}`,
        ].join('\n')

        activeChallenges.set(address, { nonce, message, issuedAt })
        return sendJson(res, 200, { ok: true, nonce, message, address })
      }

      // POST /api/v1/auth/verify — Verify wallet signature
      if (req.method === 'POST' && pathname === '/api/v1/auth/verify') {
        const body = await getJsonBody()
        const { address, signature, message } = body
        if (!address || !signature || !message) {
          return sendJson(res, 400, { ok: false, error: 'MISSING_PARAMETERS', message: 'address, signature, and message required' })
        }

        const isValid = await verifyMessage({
          address,
          message,
          signature,
        })

        if (!isValid) {
          return sendJson(res, 401, { ok: false, error: 'INVALID_SIGNATURE', message: 'Cryptographic signature verification failed' })
        }

        // Identify matching demo participant role
        const match = Object.values(DEMO_PARTICIPANTS).find(p => p.address.toLowerCase() === address.toLowerCase())

        return sendJson(res, 200, {
          ok: true,
          authenticated: true,
          address,
          participant: match || { name: 'External Participant', role: 'Guest', address },
          sessionToken: `veil_sess_${Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('')}`,
        })
      }

      // POST /api/v1/demo/identity/world-id — Issue/return World ID 4.0 proof fixture for authorized recipient
      if (req.method === 'POST' && pathname === '/api/v1/demo/identity/world-id') {
        const body = await getJsonBody()
        const recipient = body.recipient || DEMO_PARTICIPANTS.bob.address
        const ephemeralPubkey = body.ephemeralPubkey || '0x00'
        const capsuleId = body.capsuleId || '0x00'

        const proof = generateMockWorldProof({
          action: `veil-capsule-${capsuleId.slice(2, 10)}`,
          signalRecipient: recipient,
          signalPubkey: ephemeralPubkey,
          environment: 'staging',
        })

        return sendJson(res, 200, {
          ok: true,
          label: 'Local Demo Semaphore Groth16 Verifier',
          proof,
        })
      }

      // POST /api/v1/demo/identity/org-credential — Issue verified Northstar Payments role credential
      if (req.method === 'POST' && pathname === '/api/v1/demo/identity/org-credential') {
        const body = await getJsonBody()
        const recipient = body.recipient || DEMO_PARTICIPANTS.bob.address
        const capsuleId = body.capsuleId || '*'

        const cred = await issueOrgCredential({
          orgId: 'northstar',
          authorityPrivateKey: TEST_ORGS.northstar.privateKey,
          recipient,
          role: 'Security Lead',
          capsuleScope: capsuleId,
        })

        return sendJson(res, 200, {
          ok: true,
          label: 'Northstar Payments Authorized Security Lead Credential',
          credential: cred,
        })
      }

      // GET /api/v1/demo/guardians/status — Query running guardian cluster status
      if (req.method === 'GET' && pathname === '/api/v1/demo/guardians/status') {
        const guardianUrls = [
          { id: 'guardian-alpha', url: 'http://127.0.0.1:8791', port: 8791 },
          { id: 'guardian-beta', url: 'http://127.0.0.1:8792', port: 8792 },
          { id: 'guardian-gamma', url: 'http://127.0.0.1:8793', port: 8793 },
        ]

        const statuses = await Promise.all(
          guardianUrls.map(async (g) => {
            try {
              const r = await fetch(`${g.url}/health`, { signal: AbortSignal.timeout(1000) })
              const data = await r.json()
              return { ...g, online: true, ...data }
            } catch {
              return { ...g, online: false, error: 'Node unreachable or offline' }
            }
          })
        )

        return sendJson(res, 200, {
          ok: true,
          cluster: statuses,
          thresholdRequired: 2,
          totalNodes: 3,
        })
      }

      // -----------------------------------------------------------------------
      // CORE PROTOCOL ENDPOINTS
      // -----------------------------------------------------------------------

      // 1. POST /api/v1/capsules — Create a capsule (requires encrypted ciphertext or plaintext)
      if (req.method === 'POST' && pathname === '/api/v1/capsules') {
        const body = await getJsonBody()

        // Strict security assertion: refuse plaintext if someone passes raw keys
        if (body.rawDek || body.rawShares) {
          return sendJson(res, 400, {
            ok: false,
            error: 'SECURITY_VIOLATION',
            message: 'Server rejects raw DEKs or unsealed shares',
          })
        }

        const result = await client.capsules.create(body)
        return sendJson(res, 201, {
          ok: true,
          capsuleId: result.capsuleId,
          policyHash: result.policyHash,
          ciphertextHash: result.ciphertextHash,
          storageReference: result.storageReference,
          carrierText: result.carrierText,
          status: result.status,
          transactionHash: result.transactionHash,
        })
      }

      // 2. GET /api/v1/capsules/:id — Inspect onchain capsule state
      const capsuleMatch = pathname.match(/^\/api\/v1\/capsules\/([^/]+)$/)
      if (req.method === 'GET' && capsuleMatch) {
        const capsuleId = decodeURIComponent(capsuleMatch[1])
        const recipient = urlObj.searchParams.get('recipient') || undefined

        const details = await client.capsules.get(capsuleId, recipient)
        return sendJson(res, 200, { ok: true, capsule: details })
      }

      // 3. POST /api/v1/capsules/:id/approvals — Submit reviewer approval
      const approvalMatch = pathname.match(/^\/api\/v1\/capsules\/([^/]+)\/approvals$/)
      if (req.method === 'POST' && approvalMatch) {
        const capsuleId = decodeURIComponent(approvalMatch[1])
        const body = await getJsonBody()

        const txHash = await client.capsules.approve({
          capsuleId,
          signer: body.signer,
        })
        return sendJson(res, 200, { ok: true, capsuleId, transactionHash: txHash })
      }

      // 4. POST /api/v1/capsules/:id/authorize — Authorize recipient
      const authMatch = pathname.match(/^\/api\/v1\/capsules\/([^/]+)\/authorize$/)
      if (req.method === 'POST' && authMatch) {
        const capsuleId = decodeURIComponent(authMatch[1])
        const body = await getJsonBody()

        const authResult = await client.recipients.authorize({
          capsuleId,
          signer: body.signer,
          identityProof: body.identityProof,
          organizationCredential: body.organizationCredential,
        })
        return sendJson(res, 200, { ok: true, ...authResult })
      }

      // 5. POST /api/v1/capsules/:id/release — Coordinate guardian release of sealed shares
      const releaseMatch = pathname.match(/^\/api\/v1\/capsules\/([^/]+)\/release$/)
      if (req.method === 'POST' && releaseMatch) {
        const capsuleId = decodeURIComponent(releaseMatch[1])
        const body = await getJsonBody()

        if (!body.recipient || !body.recipientPub || !body.signature || !body.nonce || !body.expiry) {
          return sendJson(res, 400, {
            ok: false,
            error: 'MISSING_PARAMETERS',
            message: 'recipient, recipientPub, signature, nonce, and expiry are required',
          })
        }

        // Query guardians concurrently
        const responses = []
        for (const g of client.guardians) {
          try {
            const resp = await g.requestShare({
              capsuleId,
              recipient: body.recipient,
              recipientPub: body.recipientPub,
              nonce: body.nonce,
              expiry: body.expiry,
              signature: body.signature,
              registryAddress: client.registryAddress,
              policyHash: body.policyHash,
              worldProof: body.worldProof,
              orgCredential: body.orgCredential,
            })
            if (resp && resp.ok) {
              responses.push({
                guardianId: resp.guardianId,
                guardianAddress: resp.guardianAddress,
                shareIndex: resp.shareIndex,
                sealedShare: typeof resp.sealedShare === 'string'
                  ? resp.sealedShare
                  : Array.from(resp.sealedShare).map(b => b.toString(16).padStart(2, '0')).join(''),
                signature: resp.signature,
                timestamp: resp.timestamp,
              })
            }
          } catch {
            // Individual guardian failure tolerated if quorum reached
          }
        }

        return sendJson(res, 200, {
          ok: true,
          capsuleId,
          collectedShares: responses.length,
          shares: responses,
        })
      }

      // 6. GET /api/v1/capsules/:id/receipt — Retrieve disclosure receipt
      const receiptMatch = pathname.match(/^\/api\/v1\/capsules\/([^/]+)\/receipt$/)
      if (req.method === 'GET' && receiptMatch) {
        const capsuleId = decodeURIComponent(receiptMatch[1])
        const receipt = await client.capsules.getReceipt(capsuleId)
        return sendJson(res, 200, { ok: true, receipt })
      }

      // 404 Route Not Found
      return sendJson(res, 404, { ok: false, error: 'ROUTE_NOT_FOUND', path: pathname })
    } catch (err) {
      const statusCode = err.code === 'CAPSULE_NOT_FOUND' ? 404
        : err.code === 'CAPSULE_LOCKED' ? 423
        : err.code === 'INVALID_PARAMETER' ? 400
        : 500

      return sendJson(res, statusCode, {
        ok: false,
        error: err.code || 'INTERNAL_ERROR',
        message: err.message,
      })
    }
  })

  return {
    server,
    listen() {
      return new Promise((resolve) => {
        server.listen(port, () => resolve({ port, address: `http://localhost:${port}` }))
      })
    },
    close() {
      return new Promise((resolve) => server.close(resolve))
    },
  }
}
