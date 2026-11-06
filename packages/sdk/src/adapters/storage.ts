// VEIL Protocol SDK — Storage Adapters

import { sha256 } from '@noble/hashes/sha2.js'
import type { VeilStorageAdapter } from '../types/index.js'
import { CiphertextIntegrityError, StorageError } from '../errors/index.js'

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

/**
 * In-memory storage adapter for testing and transient sessions.
 */
export class MemoryStorageAdapter implements VeilStorageAdapter {
  private readonly store = new Map<string, Uint8Array>()

  async upload(params: { capsuleId: string; ciphertext: Uint8Array; ciphertextHash: string }): Promise<string> {
    const { ciphertext, ciphertextHash } = params
    if (!(ciphertext instanceof Uint8Array) || ciphertext.length === 0) {
      throw new StorageError('store', 'Ciphertext must be a non-empty Uint8Array')
    }

    const computed = toHex(sha256(ciphertext))
    const expected = ciphertextHash.toLowerCase().replace(/^0x/, '')
    if (computed !== expected) {
      throw new CiphertextIntegrityError(expected, computed)
    }

    this.store.set(expected, new Uint8Array(ciphertext))
    return `veil://mem/${expected}`
  }

  async download(params: { storageReference: string; expectedCiphertextHash: string }): Promise<Uint8Array> {
    const { storageReference, expectedCiphertextHash } = params
    const expected = expectedCiphertextHash.toLowerCase().replace(/^0x/, '')
    const key = storageReference.replace(/^veil:\/\/(mem|local)\//, '') || expected

    const data = this.store.get(key)
    if (!data) {
      throw new StorageError('retrieve', `Ciphertext not found for reference "${storageReference}"`)
    }

    const computed = toHex(sha256(data))
    if (computed !== expected) {
      throw new CiphertextIntegrityError(expected, computed)
    }

    return new Uint8Array(data)
  }

  async has(storageReference: string): Promise<boolean> {
    const key = storageReference.replace(/^veil:\/\/(mem|local)\//, '')
    return this.store.has(key)
  }
}
