#!/usr/bin/env node
// VEIL Protocol — Start REST API Server (Port 8088)
// Connects to local Anvil RPC and Guardian Cluster (Ports 8791, 8792, 8793)

import { startApiServer } from '../apps/api/server.mjs'
import { VeilClient } from '../packages/sdk/src/client.ts'
import { HttpGuardianAdapter } from '../packages/sdk/src/adapters/guardian.ts'
import { MemoryStorageAdapter } from '../packages/sdk/src/adapters/storage.ts'

const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 8088
const REGISTRY_ADDRESS = process.env.VEIL_POLICY_REGISTRY_ADDRESS || '0x5FbDB2315678afecb367f032d93F642f64180aa3'

const client = new VeilClient({
  rpcUrl: process.env.ETHEREUM_RPC_URL || 'http://127.0.0.1:8545',
  registryAddress: REGISTRY_ADDRESS,
  storage: new MemoryStorageAdapter(),
  guardians: [
    new HttpGuardianAdapter({ url: 'http://127.0.0.1:8791', guardianId: 'guardian-alpha' }),
    new HttpGuardianAdapter({ url: 'http://127.0.0.1:8792', guardianId: 'guardian-beta' }),
    new HttpGuardianAdapter({ url: 'http://127.0.0.1:8793', guardianId: 'guardian-gamma' }),
  ],
})

const api = startApiServer({
  port: PORT,
  client,
})

await api.listen()

console.log(`\n========================================================================`)
console.log(`  VEIL REST API SERVER (NORTHSTAR PAYMENTS SCENARIO)`)
console.log(`  http://127.0.0.1:${PORT}`)
console.log(`========================================================================\n`)
console.log('Endpoints:')
console.log('  • GET  /health')
console.log('  • GET  /api/v1/demo/participants')
console.log('  • POST /api/v1/auth/challenge')
console.log('  • POST /api/v1/auth/verify')
console.log('  • POST /api/v1/demo/identity/world-id')
console.log('  • POST /api/v1/demo/identity/org-credential')
console.log('  • GET  /api/v1/demo/guardians/status')
console.log('  • POST /api/v1/capsules')
console.log('  • GET  /api/v1/capsules/:id')
console.log('  • POST /api/v1/capsules/:id/approvals')
console.log('  • POST /api/v1/capsules/:id/authorize')
console.log('  • POST /api/v1/capsules/:id/release')
console.log('  • GET  /api/v1/capsules/:id/receipt')
