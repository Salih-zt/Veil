#!/usr/bin/env node
// HTTP Server wrapper around services/guardian/guardian.mjs.
// Runs an independent Guardian microservice instance.
//
// Routes:
//   GET  /health
//   POST /deposit                       { capsuleId, shareIndex, sealedBox, policyHash, ciphertextHash }
//   POST /capsules/:capsuleId/release   { recipient, recipientPub, nonce, expiry, signature }

import { createServer } from 'node:http'
import { createPublicClient, http } from 'viem'
import { createGuardianCore } from './guardian.mjs'

const PORT = Number(process.env.PORT || process.env.GUARDIAN_PORT || 8791)
const GUARDIAN_ID = process.env.GUARDIAN_ID || `guardian-${PORT}`
const DB_PATH = process.env.GUARDIAN_DB || `:memory:`
const PRIVATE_KEY = process.env.GUARDIAN_PRIVATE_KEY || null
const RPC_URL = process.env.EVM_RPC_URL || null
const REGISTRY_ADDRESS = process.env.VEIL_POLICY_REGISTRY_ADDRESS || null

// Configure Viem public client if RPC provided
const publicClient = RPC_URL
  ? createPublicClient({
      transport: http(RPC_URL),
    })
  : null

export function startGuardianServer({
  port = PORT,
  guardianId = GUARDIAN_ID,
  privateKey = PRIVATE_KEY,
  dbPath = DB_PATH,
  client = publicClient,
  registryAddress = REGISTRY_ADDRESS,
} = {}) {
  const guardian = createGuardianCore({
    guardianId,
    privateKey,
    dbPath,
    publicClient: client,
    registryAddress,
  })

  const server = createServer(async (req, res) => {
    // CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*')
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')

    if (req.method === 'OPTIONS') {
      res.writeHead(204)
      return res.end()
    }

    const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`)
    const pathname = url.pathname

    const sendJson = (status, data) => {
      res.writeHead(status, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(data))
    }

    const readJson = () =>
      new Promise((resolve, reject) => {
        let body = ''
        req.on('data', (chunk) => {
          body += chunk
          if (body.length > 1024 * 1024) {
            reject(new Error('Payload too large'))
          }
        })
        req.on('end', () => {
          try {
            resolve(body ? JSON.parse(body) : {})
          } catch (err) {
            reject(new Error('Invalid JSON: ' + err.message))
          }
        })
        req.on('error', reject)
      })

    try {
      // 1. GET /health
      if (req.method === 'GET' && pathname === '/health') {
        return sendJson(200, guardian.health())
      }

      // 2. POST /deposit
      if (req.method === 'POST' && pathname === '/deposit') {
        const body = await readJson()
        const result = guardian.deposit(body)
        return sendJson(200, result)
      }

      // 3. POST /capsules/:capsuleId/release
      const releaseMatch = pathname.match(/^\/capsules\/([^/]+)\/release$/)
      if (req.method === 'POST' && releaseMatch) {
        const capsuleId = decodeURIComponent(releaseMatch[1])
        const body = await readJson()
        const result = await guardian.release({ ...body, capsuleId })
        return sendJson(200, result)
      }

      return sendJson(404, { error: 'Not found' })
    } catch (err) {
      const isClientError =
        err.message.startsWith('deposit:') ||
        err.message.startsWith('release:') ||
        err.message.includes('Invalid JSON')

      const status = isClientError ? 400 : 500
      return sendJson(status, {
        error: err.message,
        guardianId: guardian.guardianId,
      })
    }
  })

  return {
    guardian,
    server,
    listen: () =>
      new Promise((resolve) => {
        server.listen(port, () => {
          console.log(`[${guardian.guardianId}] Listening on port ${port} (pub: ${guardian.pubKey})`)
          resolve(server)
        })
      }),
    close: () =>
      new Promise((resolve) => {
        server.close(resolve)
      }),
  }
}

// Direct execution from CLI
if (process.argv[1]?.endsWith('server.mjs')) {
  const runner = startGuardianServer()
  runner.listen()
}
