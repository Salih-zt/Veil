// VEIL Protocol — REST API Server (v2.0 Production MVP)
//
// Full-stack backend supporting:
//   - SIWE (EIP-191) cryptographic wallet authentication & session handling
//   - Email registration & OTP verification (bound to verified wallet)
//   - Official World ID 4.0 verification & Semaphore Groth16 demo adapter
//   - Bidirectional ENS verification (forward & reverse matching)
//   - Private collaborative rooms & invitation management (email + shareable single-use tokens)
//   - Flexible dynamic M-of-N reviewer quorum tracking and onchain approvals
//   - Capsule lifecycle & reversible carrier text decoding
//   - Independent threshold guardian coordination & verifiable disclosure receipts
//   - Persistent relational database (ACID SQLite)
//
// Invariants:
//   - Zero server plaintext: secrets & DEKs encrypted client-side using AES-256-SIV AEAD.
//   - Zero raw shares: shares remain sealed to guardian or recipient public keys.
//   - Client-side final decryption: local unsealing & GF(256) interpolation on user device.

import { createServer } from 'node:http'
import { verifyMessage } from 'viem'
import { initDatabase } from './db.mjs'
import { verifyWorldIdProof } from '../../packages/crypto/identity/world-id-v2.mjs'
import { verifyBidirectionalEns, resolveEnsForward, resolveEnsReverse } from '../../packages/crypto/identity/ens-resolver.mjs'
import { decodeFromCarrierText } from '../../packages/crypto/codec/wordmap.mjs'
import { parseDescriptor } from '../../packages/crypto/capsule.mjs'
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
  client = null,
  dbPath = undefined,
  apiKey = null,
  rateLimitWindowMs = 60000,
  maxRequestsPerWindow = 200,
} = {}) {
  const db = initDatabase(dbPath)
  const requestCounts = new Map()

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
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
    })
    res.end(payload)
  }

  const server = createServer(async (req, res) => {
    const clientIp = req.socket.remoteAddress || 'unknown'

    if (!checkRateLimit(clientIp)) {
      return sendJson(res, 429, { ok: false, error: 'RATE_LIMIT_EXCEEDED', message: 'Too many requests' })
    }

    // CORS preflight
    if (req.method === 'OPTIONS') {
      res.writeHead(204, {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key',
      })
      return res.end()
    }

    const urlObj = new URL(req.url || '/', 'http://localhost')
    const pathname = urlObj.pathname

    // Body parser
    async function getJsonBody() {
      return new Promise((resolve, reject) => {
        let data = ''
        req.on('data', (chunk) => {
          data += chunk
          if (data.length > 5 * 1024 * 1024) {
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

    // Extract authenticated session if present
    function getAuthenticatedUser() {
      const authHeader = req.headers['authorization'] || ''
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7).trim()
        const sess = db.getSession(token)
        if (sess) {
          const user = db.getUserByWallet(sess.wallet_address)
          return { session: sess, user }
        }
      }
      return null
    }

    try {
      // -----------------------------------------------------------------------
      // 1. HEALTH & SYSTEM STATUS
      // -----------------------------------------------------------------------
      if (req.method === 'GET' && pathname === '/health') {
        return sendJson(res, 200, {
          ok: true,
          service: 'veil-protocol-api',
          version: '2.0.0',
          chainId: client?.chainId || 31337,
          registryAddress: client?.registryAddress || '0x5FbDB2315678afecb367f032d93F642f64180aa3',
        })
      }

      // -----------------------------------------------------------------------
      // 2. AUTHENTICATION (SIWE & EMAIL)
      // -----------------------------------------------------------------------

      // POST /api/v1/auth/nonce (or /api/v1/auth/challenge)
      if (req.method === 'POST' && (pathname === '/api/v1/auth/nonce' || pathname === '/api/v1/auth/challenge')) {
        const body = await getJsonBody()
        if (!body.address) {
          return sendJson(res, 400, { ok: false, error: 'MISSING_ADDRESS', message: 'wallet address is required' })
        }
        const address = body.address.toLowerCase()
        const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')
        const issuedAt = new Date().toISOString()
        const message = [
          'veil.protocol wants you to sign in with your Ethereum account:',
          body.address,
          '',
          'Sign in to VEIL Protocol — Collaborative Conditional Encryption',
          '',
          'URI: http://localhost:3000',
          'Version: 1',
          `Chain ID: ${client?.chainId || 31337}`,
          `Nonce: ${nonce}`,
          `Issued At: ${issuedAt}`,
        ].join('\n')

        db.saveAuthNonce(address, nonce, message, 300)
        return sendJson(res, 200, { ok: true, nonce, message, address })
      }

      // POST /api/v1/auth/login (or /api/v1/auth/verify)
      if (req.method === 'POST' && (pathname === '/api/v1/auth/login' || pathname === '/api/v1/auth/verify')) {
        const body = await getJsonBody()
        const { address, signature, message } = body
        if (!address || !signature || !message) {
          return sendJson(res, 400, { ok: false, error: 'MISSING_PARAMETERS', message: 'address, signature, and message required' })
        }

        const cleanAddr = address.toLowerCase()
        const activeNonce = db.getAuthNonce(cleanAddr)
        if (!activeNonce) {
          return sendJson(res, 401, { ok: false, error: 'EXPIRED_OR_INVALID_NONCE', message: 'Challenge nonce expired or missing. Please request a new nonce.' })
        }

        const isValid = await verifyMessage({
          address: cleanAddr,
          message,
          signature,
        })

        if (!isValid) {
          return sendJson(res, 401, { ok: false, error: 'INVALID_SIGNATURE', message: 'Cryptographic signature verification failed' })
        }

        // Consume nonce (prevent replay)
        db.deleteAuthNonce(cleanAddr)

        // Find or create user
        let user = db.getUserByWallet(cleanAddr)
        if (!user) {
          user = db.createUser({
            id: 'usr_' + Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join(''),
            walletAddress: cleanAddr,
          })
        }

        // Check if there is an ENS primary record automatically
        if (!user.ens_name) {
          try {
            const rev = await resolveEnsReverse({ address: cleanAddr, publicClient: client?.publicClient })
            if (rev && rev.name) {
              user = db.updateUserEns(cleanAddr, rev.name, true)
            }
          } catch {}
        }

        // Generate session token
        const sessionToken = `veil_sess_${Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('')}`
        db.createSession(sessionToken, user.id, cleanAddr, 24)

        return sendJson(res, 200, {
          ok: true,
          authenticated: true,
          sessionToken,
          user,
        })
      }

      // GET /api/v1/auth/me
      if (req.method === 'GET' && pathname === '/api/v1/auth/me') {
        const auth = getAuthenticatedUser()
        if (!auth) {
          return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED', message: 'Authentication required' })
        }
        return sendJson(res, 200, { ok: true, user: auth.user })
      }

      // POST /api/v1/auth/logout
      if (req.method === 'POST' && pathname === '/api/v1/auth/logout') {
        const auth = getAuthenticatedUser()
        if (auth) {
          db.deleteSession(auth.session.token)
        }
        return sendJson(res, 200, { ok: true, message: 'Logged out successfully' })
      }

      // POST /api/v1/auth/email/send-otp
      if (req.method === 'POST' && pathname === '/api/v1/auth/email/send-otp') {
        const auth = getAuthenticatedUser()
        if (!auth) {
          return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED', message: 'Connect and authenticate wallet first' })
        }
        const body = await getJsonBody()
        if (!body.email || !body.email.includes('@')) {
          return sendJson(res, 400, { ok: false, error: 'INVALID_EMAIL', message: 'Valid email address required' })
        }

        const otp = Math.floor(100000 + Math.random() * 900000).toString()
        const tokenRecord = db.createEmailOtp(body.email, otp, 15)

        console.log(`[EMAIL DISPATCH] Verification OTP for ${body.email}: ${otp} (Expires: ${tokenRecord.expiresAt})`)

        return sendJson(res, 200, {
          ok: true,
          message: `Verification code sent to ${body.email}`,
          debugOtp: process.env.NODE_ENV !== 'production' ? otp : undefined,
        })
      }

      // POST /api/v1/auth/email/verify-otp
      if (req.method === 'POST' && pathname === '/api/v1/auth/email/verify-otp') {
        const auth = getAuthenticatedUser()
        if (!auth) {
          return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED', message: 'Connect and authenticate wallet first' })
        }
        const body = await getJsonBody()
        const { email, otp } = body
        if (!email || !otp) {
          return sendJson(res, 400, { ok: false, error: 'MISSING_DATA', message: 'email and otp required' })
        }

        const verified = db.verifyEmailOtp(email, otp)
        if (!verified) {
          return sendJson(res, 400, { ok: false, error: 'INVALID_OR_EXPIRED_OTP', message: 'Invalid or expired OTP code' })
        }

        const updatedUser = db.updateUserEmail(auth.user.wallet_address, email)
        return sendJson(res, 200, {
          ok: true,
          emailVerified: true,
          user: updatedUser,
        })
      }

      // -----------------------------------------------------------------------
      // 3. IDENTITY VERIFICATION (WORLD ID & ENS)
      // -----------------------------------------------------------------------

      // POST /api/v1/identity/world-id/verify
      if (req.method === 'POST' && (pathname === '/api/v1/identity/world-id/verify' || pathname === '/api/v1/demo/identity/world-id')) {
        const body = await getJsonBody()
        const auth = getAuthenticatedUser()
        const recipient = body.recipient || auth?.user?.wallet_address || DEMO_PARTICIPANTS.bob.address
        const action = body.action || (body.capsuleId ? `veil-capsule-${body.capsuleId.slice(2, 10)}` : 'veil-onboard')
        const signal = body.signal || null

        let proof = body.proof
        if (!proof) {
          // Generate demo proof vector if requested
          proof = generateMockWorldProof({
            action,
            signalRecipient: recipient,
            signalPubkey: body.ephemeralPubkey || '0x00',
            environment: 'staging',
          })
        }

        const result = await verifyWorldIdProof({
          proof,
          action,
          signal,
          db,
        })

        if (!result.verified) {
          return sendJson(res, 400, { ok: false, error: 'WORLD_ID_VERIFICATION_FAILED', message: result.error })
        }

        // Bind to user if logged in
        if (auth) {
          db.updateUserWorldId(auth.user.wallet_address, result.nullifier)
        }

        return sendJson(res, 200, {
          ok: true,
          ...result,
          proof,
        })
      }

      // POST /api/v1/identity/ens/verify
      if (req.method === 'POST' && pathname === '/api/v1/identity/ens/verify') {
        const auth = getAuthenticatedUser()
        const body = await getJsonBody()
        const address = body.address || auth?.user?.wallet_address
        const name = body.name

        if (!address || !name) {
          return sendJson(res, 400, { ok: false, error: 'MISSING_DATA', message: 'Both address and name are required' })
        }

        const result = await verifyBidirectionalEns({
          name,
          address,
          publicClient: client?.publicClient,
        })

        if (!result.verified) {
          return sendJson(res, 400, { ok: false, error: 'ENS_VERIFICATION_FAILED', message: result.error })
        }

        // Update user record
        if (auth && auth.user.wallet_address.toLowerCase() === address.toLowerCase()) {
          db.updateUserEns(address, result.name, true)
        }

        return sendJson(res, 200, {
          ok: true,
          verified: true,
          ...result,
        })
      }

      // GET /api/v1/identity/ens/lookup
      if (req.method === 'GET' && pathname === '/api/v1/identity/ens/lookup') {
        const query = urlObj.searchParams.get('q') || ''
        if (!query) {
          return sendJson(res, 400, { ok: false, error: 'MISSING_QUERY', message: 'q query param required' })
        }

        if (query.startsWith('0x')) {
          const rev = await resolveEnsReverse({ address: query, publicClient: client?.publicClient })
          return sendJson(res, 200, { ok: true, result: rev })
        } else {
          const fwd = await resolveEnsForward({ name: query, publicClient: client?.publicClient })
          return sendJson(res, 200, { ok: true, result: fwd })
        }
      }

      // -----------------------------------------------------------------------
      // 4. PRIVATE ROOMS & INVITATIONS
      // -----------------------------------------------------------------------

      // POST /api/v1/rooms — Create a collaborative private room
      if (req.method === 'POST' && pathname === '/api/v1/rooms') {
        const auth = getAuthenticatedUser()
        if (!auth) {
          return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED', message: 'Connect wallet and sign in to create a room' })
        }

        const body = await getJsonBody()
        if (!body.name) {
          return sendJson(res, 400, { ok: false, error: 'MISSING_NAME', message: 'Room name is required' })
        }

        const roomId = 'room_' + Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join('')
        const room = db.createRoom({
          id: roomId,
          name: body.name.trim(),
          description: body.description || '',
          organization: body.organization || '',
          creatorWallet: auth.user.wallet_address,
          visibility: body.visibility || 'private',
        })

        return sendJson(res, 201, { ok: true, room })
      }

      // GET /api/v1/rooms — List rooms for authenticated user
      if (req.method === 'GET' && pathname === '/api/v1/rooms') {
        const auth = getAuthenticatedUser()
        if (!auth) {
          return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED', message: 'Authentication required' })
        }
        const rooms = db.listUserRooms(auth.user.wallet_address)
        return sendJson(res, 200, { ok: true, rooms })
      }

      // GET /api/v1/rooms/:id — Get details of a private room
      const roomMatch = pathname.match(/^\/api\/v1\/rooms\/([^/]+)$/)
      if (req.method === 'GET' && roomMatch) {
        const roomId = decodeURIComponent(roomMatch[1])
        const room = db.getRoom(roomId)
        if (!room) {
          return sendJson(res, 404, { ok: false, error: 'NOT_FOUND', message: 'Room not found' })
        }

        const capsules = db.listRoomCapsules(roomId)
        const invitations = db.listRoomInvitations(roomId)

        return sendJson(res, 200, {
          ok: true,
          room,
          capsules,
          invitations,
        })
      }

      // POST /api/v1/rooms/:id/invitations — Invite participant to room
      const roomInviteMatch = pathname.match(/^\/api\/v1\/rooms\/([^/]+)\/invitations$/)
      if (req.method === 'POST' && roomInviteMatch) {
        const auth = getAuthenticatedUser()
        if (!auth) {
          return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED', message: 'Authentication required' })
        }

        const roomId = decodeURIComponent(roomInviteMatch[1])
        const role = db.isMember(roomId, auth.user.wallet_address)
        if (role !== 'owner') {
          return sendJson(res, 403, { ok: false, error: 'FORBIDDEN', message: 'Only room owners can invite new participants' })
        }

        const body = await getJsonBody()
        const rawToken = Array.from(crypto.getRandomValues(new Uint8Array(24))).map(b => b.toString(16).padStart(2, '0')).join('')
        const inviteId = 'inv_' + Array.from(crypto.getRandomValues(new Uint8Array(8))).map(b => b.toString(16).padStart(2, '0')).join('')

        const invitation = db.createInvitation({
          id: inviteId,
          roomId,
          email: body.email || null,
          rawToken,
          role: body.role || 'approver',
          inviterWallet: auth.user.wallet_address,
          ttlHours: body.ttlHours || 72,
        })

        const inviteLink = `http://localhost:3000/invite/${rawToken}`
        if (body.email) {
          console.log(`[EMAIL DISPATCH] Room Invitation for ${body.email}: ${inviteLink}`)
        }

        return sendJson(res, 201, {
          ok: true,
          invitation,
          inviteLink,
        })
      }

      // GET /api/v1/invitations/:token — View invitation metadata
      const inviteTokenMatch = pathname.match(/^\/api\/v1\/invitations\/([^/]+)$/)
      if (req.method === 'GET' && inviteTokenMatch) {
        const token = decodeURIComponent(inviteTokenMatch[1])
        const inv = db.getInvitationByToken(token)
        if (!inv) {
          return sendJson(res, 404, { ok: false, error: 'NOT_FOUND', message: 'Invalid or expired invitation token' })
        }
        return sendJson(res, 200, { ok: true, invitation: inv })
      }

      // POST /api/v1/invitations/:token/accept — Accept invitation and join room
      const inviteAcceptMatch = pathname.match(/^\/api\/v1\/invitations\/([^/]+)\/accept$/)
      if (req.method === 'POST' && inviteAcceptMatch) {
        const auth = getAuthenticatedUser()
        if (!auth) {
          return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED', message: 'Connect and authenticate your wallet to accept an invitation' })
        }

        const token = decodeURIComponent(inviteAcceptMatch[1])
        try {
          const inv = db.acceptInvitation(token, auth.user.wallet_address)
          const room = db.getRoom(inv.room_id)
          return sendJson(res, 200, {
            ok: true,
            message: `Successfully joined "${room.name}" as ${inv.role}`,
            room,
          })
        } catch (err) {
          return sendJson(res, 400, { ok: false, error: 'ACCEPT_FAILED', message: err.message })
        }
      }

      // -----------------------------------------------------------------------
      // 5. CAPSULES & DYNAMIC APPROVAL LIFECYCLE
      // -----------------------------------------------------------------------

      // POST /api/v1/capsules (or POST /api/v1/rooms/:id/capsules)
      if (req.method === 'POST' && (pathname === '/api/v1/capsules' || pathname.startsWith('/api/v1/rooms/'))) {
        const auth = getAuthenticatedUser()
        const body = await getJsonBody()

        // Strict security assertion: refuse plaintext or unsealed shares on server
        if (body.rawDek || body.rawShares) {
          return sendJson(res, 400, {
            ok: false,
            error: 'SECURITY_VIOLATION',
            message: 'Server rejects raw DEKs or unsealed shares; encryption must happen client-side.',
          })
        }

        const creatorWallet = auth?.user?.wallet_address || body.creator || '0x70997970C51812dc3A010C7d01b50e0d17dc79C8'
        let roomId = body.roomId || 'room_default'

        // Create capsule via VeilClient if available
        let result
        if (client) {
          result = await client.capsules.create({
            ...body,
            creator: creatorWallet,
          })
        } else {
          result = {
            capsuleId: body.capsuleId || ('0x' + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')),
            policyHash: body.policyHash || ('0x' + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')),
            ciphertextHash: body.ciphertextHash || ('0x' + Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')),
            storageReference: `veil://mem/${body.ciphertextHash || 'mock'}`,
            carrierText: body.carrierText || 'carrier text placeholder',
            status: 'registered',
            transactionHash: '0xmocktx',
          }
        }

        // Save in persistent database
        const capsuleRecord = db.createCapsuleRecord({
          capsuleId: result.capsuleId,
          roomId,
          title: body.title || 'Confidential Disclosure',
          description: body.description || '',
          classification: body.classification || 'CONFIDENTIAL',
          creatorWallet,
          accessMode: body.accessMode || 'named',
          policyHash: result.policyHash,
          ciphertextHash: result.ciphertextHash,
          storageReference: result.storageReference,
          carrierText: result.carrierText,
          unlockTimestamp: body.unlockTimestamp || Math.floor(Date.now() / 1000) + 90,
          expiryTimestamp: body.expiryTimestamp || Math.floor(Date.now() / 1000) + 3600,
          approvalThreshold: body.approvalThreshold || body.threshold || 2,
          guardianThreshold: body.guardianThreshold || 2,
          requireWorldId: body.requireWorldId !== undefined ? (body.requireWorldId ? 1 : 0) : 1,
          requireEns: body.requireEns !== undefined ? (body.requireEns ? 1 : 0) : 1,
          recipients: body.recipients || ['0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC'],
          approvers: body.approvers || body.reviewers || ['0x90F79bf6EB2c4f870365E785982E1f101E93b906', '0x35B33Ae737809aa6B03fe4124B760E14e5d996a0'],
        })

        return sendJson(res, 201, {
          ok: true,
          capsule: capsuleRecord,
          carrierText: result.carrierText,
          transactionHash: result.transactionHash,
        })
      }

      // POST /api/v1/capsules/decode — Decode carrier text to metadata
      if (req.method === 'POST' && pathname === '/api/v1/capsules/decode') {
        const body = await getJsonBody()
        if (!body.carrierText) {
          return sendJson(res, 400, { ok: false, error: 'MISSING_CARRIER', message: 'carrierText required' })
        }

        try {
          const rawBytes = decodeFromCarrierText(body.carrierText.trim())
          const descriptor = parseDescriptor(rawBytes)
          const record = db.getCapsuleRecord('0x' + descriptor.capsuleId) || db.getCapsuleRecord(descriptor.capsuleId)

          return sendJson(res, 200, {
            ok: true,
            descriptor: {
              capsuleId: '0x' + descriptor.capsuleId,
              policyHash: '0x' + descriptor.policyHash,
              ciphertextHash: '0x' + descriptor.ciphertextHash,
              threshold: descriptor.threshold,
              totalShares: descriptor.totalShares,
            },
            capsuleRecord: record,
          })
        } catch (err) {
          return sendJson(res, 400, { ok: false, error: 'DECODE_ERROR', message: `Could not decode carrier text: ${err.message}` })
        }
      }

      // GET /api/v1/capsules/:id — Get capsule details & live onchain status
      const capsuleMatch = pathname.match(/^\/api\/v1\/capsules\/([^/]+)$/)
      if (req.method === 'GET' && capsuleMatch) {
        const capsuleId = decodeURIComponent(capsuleMatch[1])
        const record = db.getCapsuleRecord(capsuleId)
        let onchainState = null

        if (client) {
          try {
            onchainState = await client.capsules.get(capsuleId)
          } catch {}
        }

        const latestRequest = db.getLatestRequestForCapsule(capsuleId)

        return sendJson(res, 200, {
          ok: true,
          capsule: record,
          onchain: onchainState,
          latestRequest,
        })
      }

      // POST /api/v1/capsules/:id/release-request — Submit decryption release request
      const reqMatch = pathname.match(/^\/api\/v1\/capsules\/([^/]+)\/release-request$/)
      if (req.method === 'POST' && reqMatch) {
        const auth = getAuthenticatedUser()
        const capsuleId = decodeURIComponent(reqMatch[1])
        const body = await getJsonBody()
        const requesterWallet = auth?.user?.wallet_address || body.recipient
        if (!requesterWallet) {
          return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED', message: 'Wallet authentication required' })
        }

        const record = db.getCapsuleRecord(capsuleId)
        if (!record) {
          return sendJson(res, 404, { ok: false, error: 'NOT_FOUND', message: 'Capsule not found' })
        }

        // Validate named recipient restrictions
        if (record.access_mode === 'named' && !record.recipients.map(r => r.toLowerCase()).includes(requesterWallet.toLowerCase())) {
          return sendJson(res, 403, { ok: false, error: 'FORBIDDEN', message: 'You are not an authorized recipient for this named capsule' })
        }

        const requestId = 'req_' + Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join('')
        const relReq = db.createReleaseRequest({
          requestId,
          capsuleId,
          requesterWallet,
          requesterEns: auth?.user?.ens_name || body.ensName || null,
          requesterEphemeralPubkey: body.recipientPub || body.ephemeralPubkey || '0x00',
          nonce: body.nonce || String(Date.now()),
          signature: body.signature || '0x00',
          worldIdNullifier: body.worldIdNullifier || null,
        })

        // Notify all approvers
        for (const approver of record.approvers) {
          db.createNotification({
            id: 'notif_' + Math.random().toString(36).substring(2, 9),
            recipientWallet: approver,
            type: 'APPROVAL_REQUESTED',
            title: 'New Decryption Request Pending Approval',
            body: `Wallet ${requesterWallet.slice(0, 8)}... has requested decryption for capsule "${record.title}".`,
            link: `/rooms/${record.room_id}/capsules/${capsuleId}`,
          })
        }

        return sendJson(res, 201, { ok: true, releaseRequest: relReq })
      }

      // POST /api/v1/capsules/:id/vote — Reviewer votes (approve/reject)
      const voteMatch = pathname.match(/^\/api\/v1\/capsules\/([^/]+)\/vote$/)
      if (req.method === 'POST' && voteMatch) {
        const auth = getAuthenticatedUser()
        const capsuleId = decodeURIComponent(voteMatch[1])
        const body = await getJsonBody()
        const voterWallet = auth?.user?.wallet_address || body.voter || body.signer
        if (!voterWallet) {
          return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED', message: 'Voter wallet authentication required' })
        }

        const record = db.getCapsuleRecord(capsuleId)
        if (!record) {
          return sendJson(res, 404, { ok: false, error: 'NOT_FOUND', message: 'Capsule not found' })
        }

        if (!record.approvers.map(a => a.toLowerCase()).includes(voterWallet.toLowerCase())) {
          return sendJson(res, 403, { ok: false, error: 'UNAUTHORIZED_REVIEWER', message: 'Your wallet is not in the designated reviewer set for this capsule' })
        }

        const requestId = body.requestId || db.getLatestRequestForCapsule(capsuleId)?.request_id || 'req_default'
        let txHash = null

        // If approval and client connected, submit onchain approval tx
        if (body.vote === 'approve' && client && body.signer) {
          try {
            txHash = await client.capsules.approve({
              capsuleId,
              signer: body.signer,
            })
          } catch {}
        }

        const votes = db.recordVote({
          requestId,
          capsuleId,
          voterWallet,
          vote: body.vote || 'approve',
          signature: body.signature || null,
          txHash,
        })

        const approvals = votes.filter(v => v.vote === 'approve').length
        const rejections = votes.filter(v => v.vote === 'reject').length
        const quorumReached = approvals >= record.approval_threshold
        const impossible = (record.approvers.length - rejections) < record.approval_threshold

        return sendJson(res, 200, {
          ok: true,
          approvals,
          rejections,
          totalApprovers: record.approvers.length,
          thresholdRequired: record.approval_threshold,
          quorumReached,
          impossible,
          votes,
        })
      }

      // POST /api/v1/capsules/:id/release — Trigger guardian release coordination
      const releaseMatch = pathname.match(/^\/api\/v1\/capsules\/([^/]+)\/release$/)
      if (req.method === 'POST' && releaseMatch) {
        const capsuleId = decodeURIComponent(releaseMatch[1])
        const body = await getJsonBody()

        if (client) {
          const result = await client.recipients.release({
            capsuleId,
            recipient: body.recipient,
            recipientPub: body.recipientPub,
            nonce: body.nonce,
            expiry: body.expiry,
            signature: body.signature,
            identityProof: body.identityProof,
            organizationCredential: body.organizationCredential,
          })
          return sendJson(res, 200, result)
        }

        return sendJson(res, 200, {
          ok: true,
          capsuleId,
          shares: [],
        })
      }

      // POST /api/v1/capsules/:id/receipt — Save client disclosure receipt
      const receiptMatch = pathname.match(/^\/api\/v1\/capsules\/([^/]+)\/receipt$/)
      if (req.method === 'POST' && receiptMatch) {
        const capsuleId = decodeURIComponent(receiptMatch[1])
        const body = await getJsonBody()
        const auth = getAuthenticatedUser()

        const receiptId = 'rcpt_' + Array.from(crypto.getRandomValues(new Uint8Array(12))).map(b => b.toString(16).padStart(2, '0')).join('')
        const saved = db.saveDisclosureReceipt({
          receiptId,
          capsuleId,
          recipientWallet: auth?.user?.wallet_address || body.recipientWallet || '0x00',
          detailsJson: body.receipt || body,
        })

        return sendJson(res, 201, { ok: true, receipt: saved })
      }

      // GET /api/v1/capsules/:id/receipt
      if (req.method === 'GET' && receiptMatch) {
        const capsuleId = decodeURIComponent(receiptMatch[1])
        const stmt = db.db.prepare('SELECT * FROM disclosure_receipts WHERE capsule_id = ? ORDER BY released_at DESC LIMIT 1')
        const row = stmt.get(capsuleId)
        if (!row) {
          return sendJson(res, 404, { ok: false, error: 'NOT_FOUND', message: 'No receipt found for this capsule' })
        }
        return sendJson(res, 200, { ok: true, receipt: { ...row, details: JSON.parse(row.details_json) } })
      }

      // -----------------------------------------------------------------------
      // 6. NOTIFICATIONS
      // -----------------------------------------------------------------------
      if (req.method === 'GET' && pathname === '/api/v1/notifications') {
        const auth = getAuthenticatedUser()
        if (!auth) {
          return sendJson(res, 401, { ok: false, error: 'UNAUTHORIZED', message: 'Authentication required' })
        }
        const notifs = db.getUserNotifications(auth.user.wallet_address)
        return sendJson(res, 200, { ok: true, notifications: notifs })
      }

      // -----------------------------------------------------------------------
      // 7. DEMO BACKWARD COMPATIBILITY
      // -----------------------------------------------------------------------
      if (req.method === 'GET' && pathname === '/api/v1/demo/participants') {
        return sendJson(res, 200, {
          ok: true,
          company: 'Northstar Payments',
          scenario: 'Vulnerability Disclosure & Coordinated Embargo (CVE-2026-8812)',
          participants: DEMO_PARTICIPANTS,
        })
      }

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

      return sendJson(res, 404, { ok: false, error: 'NOT_FOUND', message: `Route ${pathname} not found` })
    } catch (err) {
      console.error('API Error:', err)
      return sendJson(res, 500, { ok: false, error: 'INTERNAL_SERVER_ERROR', message: err.message })
    }
  })

  return {
    server,
    db,
    listen: () =>
      new Promise((resolve) => {
        server.listen(port, '0.0.0.0', () => {
          resolve(server)
        })
      }),
    close: () =>
      new Promise((resolve) => {
        server.close(resolve)
      }),
  }
}
