#!/usr/bin/env node
// VEIL Protocol — Zero-Dependency Web Dashboard Server
// Serves apps/web/dashboard.html on http://localhost:3000

import { createServer } from 'node:http'
import { readFileSync, existsSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const DASHBOARD_HTML = resolve(ROOT, 'apps/web/dashboard.html')
const PORT = 3000

const server = createServer((req, res) => {
  const urlPath = req.url.split('?')[0]
  if (!urlPath.includes('.') || urlPath.endsWith('.html') || urlPath.startsWith('/invite/') || urlPath.startsWith('/rooms/')) {
    if (existsSync(DASHBOARD_HTML)) {
      const html = readFileSync(DASHBOARD_HTML, 'utf8')
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
      res.end(html)
      return
    }
  }
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.end('404 Not Found')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`\n========================================================================`)
  console.log(`  VEIL CYBERSECURITY DASHBOARD RUNNING AT:`)
  console.log(`  http://localhost:${PORT}`)
  console.log(`========================================================================\n`)
  console.log(`Open http://localhost:${PORT} in your browser to interact with the dashboard.`)
})
