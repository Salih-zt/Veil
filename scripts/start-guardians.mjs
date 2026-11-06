#!/usr/bin/env node
// VEIL Protocol — Start Independent Guardian Cluster (Ports 8791, 8792, 8793)

import { startGuardianCluster } from '../packages/guardian/cluster.mjs'

console.log('Starting VEIL Guardian Cluster...')

const cluster = await startGuardianCluster({
  nodes: [
    { port: 8791, guardianId: 'guardian-alpha' },
    { port: 8792, guardianId: 'guardian-beta' },
    { port: 8793, guardianId: 'guardian-gamma' },
  ],
})

console.log('VEIL Guardian Cluster running on:')
for (const node of cluster.nodes) {
  console.log(`  • [${node.guardianId}] http://127.0.0.1:${node.port} (Pubkey: ${node.pubkey})`)
}
console.log('Press Ctrl+C to terminate cluster.')
