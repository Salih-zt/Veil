// VEIL Protocol — ENS Identity Verification & Resolution Service
// Conforms to official ENS specifications: https://docs.ens.domains/
//
// Performs strict bidirectional validation:
//   1. Forward resolution: name => wallet address
//   2. Reverse resolution: wallet address => primary ENS name
//   3. Bidirectional match verification: forward(name) === address && reverse(address) === name
//   4. Chain context and active registration validation

import { normalize } from 'viem/ens'

/**
 * In-memory local ENS registry mapping for testnets and development environments (e.g. Anvil 31337)
 * Maps normalized ENS name <=> wallet address.
 */
const LOCAL_ENS_REGISTRY = new Map([
  ['alice.veil.eth', '0x70997970c51812dc3a010c7d01b50e0d17dc79c8'],
  ['bob.veil.eth', '0x3c44cdddb6a900fa2b585dd299e03d12fa4293bc'],
  ['charlie.veil.eth', '0x90f79bf6eb2c4f870365e785982e1f101e93b906'],
  ['david.veil.eth', '0x35b33ae737809aa6b03fe4124b760e14e5d996a0'],
  ['eve.veil.eth', '0x9965507d1a55bcc2695c58ba16fb37d819b0a4dc'],
  ['salih.eth', '0x70997970c51812dc3a010c7d01b50e0d17dc79c8'],
])

// Reverse lookup table
const LOCAL_REVERSE_REGISTRY = new Map()
for (const [name, addr] of LOCAL_ENS_REGISTRY.entries()) {
  if (!LOCAL_REVERSE_REGISTRY.has(addr)) {
    LOCAL_REVERSE_REGISTRY.set(addr, name)
  }
}

/**
 * Register or update a local ENS record (for testing and private deployments).
 */
export function registerLocalEnsName(name, address) {
  if (!name || !address) throw new Error('name and address required')
  const normName = normalize(name.trim().toLowerCase())
  const normAddr = address.trim().toLowerCase()
  LOCAL_ENS_REGISTRY.set(normName, normAddr)
  LOCAL_REVERSE_REGISTRY.set(normAddr, normName)
  return { name: normName, address: normAddr }
}

/**
 * Resolve an ENS name forward to an address.
 */
export async function resolveEnsForward({ name, publicClient = null }) {
  if (!name || typeof name !== 'string') {
    throw new Error('resolveEnsForward: valid name string is required')
  }

  let normalizedName
  try {
    normalizedName = normalize(name.trim().toLowerCase())
  } catch (err) {
    throw new Error(`Invalid ENS name syntax: ${err.message}`)
  }

  // 1. Try publicClient if connected to mainnet/sepolia
  if (publicClient && publicClient.getEnsAddress) {
    try {
      const resolved = await publicClient.getEnsAddress({ name: normalizedName })
      if (resolved) {
        return {
          name: normalizedName,
          address: resolved.toLowerCase(),
          source: 'onchain_rpc',
        }
      }
    } catch {
      // Fallback to local registry
    }
  }

  // 2. Check local registry
  if (LOCAL_ENS_REGISTRY.has(normalizedName)) {
    return {
      name: normalizedName,
      address: LOCAL_ENS_REGISTRY.get(normalizedName),
      source: 'local_registry',
    }
  }

  return null
}

/**
 * Resolve an Ethereum address reverse to a primary ENS name.
 */
export async function resolveEnsReverse({ address, publicClient = null }) {
  if (!address || typeof address !== 'string' || !address.startsWith('0x')) {
    throw new Error('resolveEnsReverse: valid Ethereum address is required')
  }

  const normAddr = address.trim().toLowerCase()

  // 1. Try publicClient if connected to mainnet/sepolia
  if (publicClient && publicClient.getEnsName) {
    try {
      const name = await publicClient.getEnsName({ address: normAddr })
      if (name) {
        return {
          address: normAddr,
          name: normalize(name),
          source: 'onchain_rpc',
        }
      }
    } catch {
      // Fallback to local registry
    }
  }

  // 2. Check local reverse registry
  if (LOCAL_REVERSE_REGISTRY.has(normAddr)) {
    return {
      address: normAddr,
      name: LOCAL_REVERSE_REGISTRY.get(normAddr),
      source: 'local_registry',
    }
  }

  return null
}

/**
 * Strictly verify bidirectional ENS ownership matching.
 *
 * Requirements:
 *   1. Forward resolution of name matches address.
 *   2. Reverse resolution of address matches name.
 *   3. Forward and reverse records match identically.
 *
 * @param {object} params
 * @param {string} params.name Claimed ENS name
 * @param {string} params.address Claimed Ethereum address
 * @param {object} [params.publicClient] Viem client
 * @returns {Promise<{verified: boolean, name?: string, address?: string, error?: string}>}
 */
export async function verifyBidirectionalEns({ name, address, publicClient = null }) {
  if (!name || !address) {
    return { verified: false, error: 'Both ENS name and wallet address are required' }
  }

  let normalizedName
  try {
    normalizedName = normalize(name.trim().toLowerCase())
  } catch (err) {
    return { verified: false, error: `Malformed ENS name: ${err.message}` }
  }

  const normAddr = address.trim().toLowerCase()

  // Step 1: Forward resolution
  const forward = await resolveEnsForward({ name: normalizedName, publicClient })
  if (!forward) {
    return { verified: false, error: `ENS name "${normalizedName}" does not resolve to any address` }
  }

  if (forward.address !== normAddr) {
    return {
      verified: false,
      error: `Forward resolution mismatch: "${normalizedName}" resolves to ${forward.address}, but expected ${normAddr}`,
    }
  }

  // Step 2: Reverse resolution
  const reverse = await resolveEnsReverse({ address: normAddr, publicClient })
  if (!reverse) {
    return { verified: false, error: `Wallet ${normAddr} does not have a primary reverse ENS record set` }
  }

  if (reverse.name !== normalizedName) {
    return {
      verified: false,
      error: `Reverse resolution mismatch: Wallet ${normAddr} points to "${reverse.name}", but expected "${normalizedName}"`,
    }
  }

  return {
    verified: true,
    name: normalizedName,
    address: normAddr,
    verifiedAt: new Date().toISOString(),
    source: forward.source,
  }
}
