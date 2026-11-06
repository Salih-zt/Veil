#!/usr/bin/env node
// VEIL Protocol — Start REST API Server (Port 8088)

import { startApiServer } from '../apps/api/server.mjs'

const PORT = process.env.API_PORT ? parseInt(process.env.API_PORT, 10) : 8088

const server = startApiServer({
  port: PORT,
})

console.log(`VEIL REST API Server running at http://127.0.0.1:${PORT}`)
console.log('Endpoints:')
console.log('  • GET  /health')
console.log('  • GET  /api/v1/capsules/:id')
console.log('  • POST /api/v1/capsules')
console.log('  • POST /api/v1/approvals')
console.log('  • POST /api/v1/authorize')
console.log('  • POST /api/v1/release')
console.log('  • GET  /api/v1/receipt/:id')
