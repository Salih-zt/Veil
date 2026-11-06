// Guardian 3-Node Cluster Orchestrator
// Launches Guardian A (8791), Guardian B (8792), Guardian C (8793) locally.

import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { startGuardianServer } from './server.mjs'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = join(HERE, '.data')
mkdirSync(DATA_DIR, { recursive: true })

export const GUARDIAN_CONFIGS = [
  {
    guardianId: 'guardian-a',
    port: 8791,
    dbPath: join(DATA_DIR, 'guardian_a.sqlite'),
  },
  {
    guardianId: 'guardian-b',
    port: 8792,
    dbPath: join(DATA_DIR, 'guardian_b.sqlite'),
  },
  {
    guardianId: 'guardian-c',
    port: 8793,
    dbPath: join(DATA_DIR, 'guardian_c.sqlite'),
  },
]

export async function startGuardianCluster(overrides = {}) {
  const configs = overrides.nodes || GUARDIAN_CONFIGS
  const instances = []
  const nodes = []
  for (const cfg of configs) {
    const dbPath = cfg.dbPath || join(DATA_DIR, `${cfg.guardianId || 'guardian'}.sqlite`)
    const runner = startGuardianServer({
      ...cfg,
      ...overrides,
      dbPath: overrides.inMemory ? ':memory:' : dbPath,
    })
    await runner.listen()
    instances.push(runner)
    nodes.push({
      guardianId: runner.guardian.guardianId,
      port: cfg.port,
      pubkey: runner.guardian.pubKey,
      instance: runner,
    })
  }
  return {
    instances,
    nodes,
    close: async () => {
      for (const inst of instances) {
        await inst.close()
      }
    },
  }
}

export const startCluster = startGuardianCluster

// Direct CLI start
if (process.argv[1]?.endsWith('cluster.mjs')) {
  console.log('Starting VEIL 3-node Guardian cluster...')
  startCluster().then(() => {
    console.log('All 3 guardians running on ports 8791, 8792, 8793.')
  })
}
