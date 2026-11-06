// VEIL Ciphertext Storage Abstraction Layer
//
// Implements secure, hash-verified storage for encrypted capsule payloads:
//   - Stores CIPHERTEXT ONLY: plaintext and DEKs never touch storage.
//   - Cryptographic integrity verification: sha256(retrieved) === expectedHash.
//   - Pluggable driver architecture: in-memory, local filesystem, or decentralized (0G, Walrus, IPFS).

import { sha256 } from '@noble/hashes/sha2.js'
import { toHex, fromHex } from '../keys.mjs'

/**
 * Creates a storage driver instance.
 *
 * @param {object} [options]
 * @param {'memory'|'filesystem'} [options.type='memory'] Driver type
 * @param {string} [options.basePath] Base path for filesystem driver
 */
export function createStorageDriver({ type = 'memory' } = {}) {
  const memoryStore = new Map()

  return {
    type,

    /**
     * Store encrypted ciphertext and return a verifiable storage reference.
     *
     * @param {object} params
     * @param {string} params.capsuleId
     * @param {Uint8Array} params.ciphertext Encrypted payload
     * @param {string} params.ciphertextHash Expected SHA-256 hex string
     * @returns {Promise<{ storageRef: string, ciphertextHash: string, size: number }>}
     */
    async store({ capsuleId, ciphertext, ciphertextHash }) {
      if (!(ciphertext instanceof Uint8Array) || ciphertext.length === 0) {
        throw new Error('store: ciphertext must be a non-empty Uint8Array')
      }
      if (!ciphertextHash) {
        throw new Error('store: ciphertextHash is required')
      }

      // Verify integrity before storing
      const computedHash = toHex(sha256(ciphertext))
      const cleanExpected = ciphertextHash.toLowerCase().replace(/^0x/, '')
      if (computedHash.toLowerCase() !== cleanExpected) {
        throw new Error(
          `store: computed ciphertext hash (${computedHash}) does not match expected (${cleanExpected})`
        )
      }

      const storageRef = `veil://local/${cleanExpected}`
      memoryStore.set(cleanExpected, new Uint8Array(ciphertext))

      return {
        storageRef,
        ciphertextHash: `0x${cleanExpected}`,
        size: ciphertext.length,
      }
    },

    /**
     * Retrieve ciphertext by storage reference and verify integrity against expected hash.
     *
     * @param {object} params
     * @param {string} params.storageRef Storage reference URI
     * @param {string} params.expectedCiphertextHash Expected 32-byte hash
     * @returns {Promise<Uint8Array>} Verified ciphertext
     */
    async retrieve({ storageRef, expectedCiphertextHash }) {
      if (!storageRef) throw new Error('retrieve: storageRef is required')
      if (!expectedCiphertextHash) throw new Error('retrieve: expectedCiphertextHash is required')

      const cleanExpected = expectedCiphertextHash.toLowerCase().replace(/^0x/, '')
      const key = storageRef.startsWith('veil://local/')
        ? storageRef.slice('veil://local/'.length)
        : cleanExpected

      const data = memoryStore.get(key)
      if (!data) {
        throw new Error(`retrieve: ciphertext not found for storageRef "${storageRef}"`)
      }

      // Cryptographic integrity check
      const computedHash = toHex(sha256(data))
      if (computedHash.toLowerCase() !== cleanExpected) {
        throw new Error(
          `retrieve: integrity violation! Ciphertext hash (${computedHash}) does not match policy commitment (${cleanExpected})`
        )
      }

      return new Uint8Array(data)
    },

    /**
     * Check if ciphertext exists in storage.
     */
    async has(storageRef) {
      if (!storageRef) return false
      const key = storageRef.startsWith('veil://local/')
        ? storageRef.slice('veil://local/'.length)
        : storageRef
      return memoryStore.has(key)
    },

    /**
     * Clear all stored ciphertexts (for testing).
     */
    clear() {
      memoryStore.clear()
    },
  }
}

export const defaultStorage = createStorageDriver({ type: 'memory' })
