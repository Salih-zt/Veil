#!/usr/bin/env node
// VEIL Protocol — Unified Test Runner
// Runs Foundry contract tests, crypto unit tests, SDK tests, and end-to-end scenario.

import { spawnSync } from 'node:child_process'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')

const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const RED = '\x1b[31m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'

function banner(text) {
  console.log(`\n${BOLD}${CYAN}========================================================================${RESET}`)
  console.log(`${BOLD}${CYAN}  ${text}${RESET}`)
  console.log(`${BOLD}${CYAN}========================================================================${RESET}\n`)
}

function runStep(name, cmd, args, cwd = ROOT) {
  console.log(`${BOLD}${YELLOW}▶ RUNNING: ${name}${RESET}`)
  const res = spawnSync(cmd, args, {
    cwd,
    stdio: 'inherit',
    shell: true,
  })
  if (res.status !== 0) {
    console.error(`\n${BOLD}${RED}✖ FAILED: ${name} (Exit code: ${res.status})${RESET}`)
    process.exit(res.status ?? 1)
  }
  console.log(`${BOLD}${GREEN}✔ PASSED: ${name}${RESET}\n`)
}

banner('VEIL PROTOCOL — COMPREHENSIVE TEST SUITE')

// 1. Foundry Smart Contract Tests
runStep(
  'Foundry Contract Tests (VeilPolicyRegistry.t.sol)',
  'forge.exe',
  ['test'],
  resolve(ROOT, 'contracts')
)

// 2. JavaScript & TypeScript Unit Tests
runStep(
  'JavaScript & TypeScript Unit Tests (81 Tests: Crypto, SSS, Identity, SDK, Workflow)',
  'node',
  ['--import', './test/lib/resolve-ts.mjs', '--test', 'test/unit/*.test.mjs'],
  ROOT
)

// 3. End-to-End Vulnerability Disclosure Scenario
runStep(
  'SDK Vulnerability Disclosure Scenario (examples/vulnerability-disclosure)',
  'node',
  ['--import', './test/lib/resolve-ts.mjs', 'examples/vulnerability-disclosure/run-scenario.ts'],
  ROOT
)

// 4. End-to-End 9-Step Protocol Walkthrough
runStep(
  'End-to-End 9-Step Protocol Walkthrough (scripts/demo-e2e.mjs)',
  'node',
  ['--import', './test/lib/resolve-ts.mjs', 'scripts/demo-e2e.mjs'],
  ROOT
)

banner('ALL TEST TIERS PASSED WITH ZERO FAILURES (100% PROTOCOL INTEGRITY)')
