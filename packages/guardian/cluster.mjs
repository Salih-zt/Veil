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

export async function startCluster(overrides = {}) {
  const instances = []
  for (const cfg of GUARDIAN_CONFIGS) {
    const runner = startGuardianServer({
      ...cfg,
      ...overrides,
      dbPath: overrides.inMemory ? ':memory:' : cfg.dbPath,
    })
    await runner.listen()
    instances.push(runner)
  }
  return {
    instances,
    close: async () => {
      for (const inst of instances) {
        await inst.close()
      }
    },
  }
}

// Direct CLI start
if (process.argv[1]?.endsWith('cluster.mjs')) {
  console.log('Starting VEIL 3-node Guardian cluster...')
  startCluster().then(() => {
    console.log('All 3 guardians running on ports 8791, 8792, 8793.')
  })
}
