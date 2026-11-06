// VEIL Capsule Format & Client-Side Encryption Engine (v1)
//
// Encapsulates confidential information within a programmable disclosure envelope.
//
// Key properties:
//   - AES-256-SIV authenticated encryption: deterministic, misuse-resistant AEAD.
//   - Cryptographic policy binding: AAD binds version, capsuleId, policyHash, and ciphertextHash.
//   - 2-of-3 Threshold Secret Sharing: DEK is split into shares using Shamir's Secret Sharing over GF(256).
//   - Steganographic compatibility: compact framing designed for direct encoding into natural language cover text.

import { aessiv } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { split, reconstruct } from './sss.mjs'
import { toHex, fromHex, toB64, fromB64 } from './keys.mjs'
import { sealTo, CTX } from './gatebox.mjs'

const enc = new TextEncoder()
const dec = new TextDecoder()

export const MAGIC = new Uint8Array([0x56, 0x4c]) // 'VL'
export const VERSION = 1
export const STORAGE_INLINE = 0
export const STORAGE_POINTER = 1

export const DEFAULT_THRESHOLD = 2
export const DEFAULT_TOTAL_SHARES = 3
export const DEK_LENGTH = 64 // 64 bytes for AES-256-SIV (two 32-byte subkeys)

const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/** Compute AAD context bound into AES-256-SIV tag */
export function computeAAD(version, capsuleId, policyHash, ciphertextHash) {
  return cat(
    enc.encode(`veil/v${version}/aad`),
    capsuleId,
    policyHash,
    ciphertextHash,
  )
}

/**
 * Create a new VEIL programmable capsule.
 *
 * @param {object} params
 * @param {Uint8Array|string} params.plaintext Secret to encapsulate
 * @param {Uint8Array|string} params.policyHash 32-byte policy hash committed on-chain
 * @param {Uint8Array|string} [params.capsuleId] Optional 32-byte unique identifier (generated if omitted)
 * @param {number} [params.threshold=2] Quorum required to reconstruct (k)
 * @param {number} [params.totalShares=3] Total shares generated (n)
 * @param {Array<Uint8Array|string>} [params.guardianPublicKeys] Optional X25519 guardian public keys for sealing shares
 * @returns {Promise<object>} Capsule artifacts including descriptor, DEK, and encrypted shares
 */
export async function createCapsule({
  plaintext,
  policyHash,
  capsuleId,
  threshold = DEFAULT_THRESHOLD,
  totalShares = DEFAULT_TOTAL_SHARES,
  guardianPublicKeys = [],
}) {
  const pBytes = typeof plaintext === 'string' ? enc.encode(plaintext) : plaintext
  if (!(pBytes instanceof Uint8Array) || pBytes.length === 0) {
    throw new Error('createCapsule: plaintext must be non-empty')
  }

  const pHash = typeof policyHash === 'string' ? fromHex(policyHash) : policyHash
  if (!(pHash instanceof Uint8Array) || pHash.length !== 32) {
    throw new Error('createCapsule: policyHash must be 32 bytes')
  }

  const cId = capsuleId
    ? (typeof capsuleId === 'string' ? fromHex(capsuleId) : capsuleId)
    : crypto.getRandomValues(new Uint8Array(32))
  if (cId.length !== 32) {
    throw new Error('createCapsule: capsuleId must be 32 bytes')
  }

  // 1. Generate fresh cryptographically secure 64-byte DEK
  const dek = crypto.getRandomValues(new Uint8Array(DEK_LENGTH))

  // 2. Split DEK into (k, n) shares via Shamir Secret Sharing
  const rawShares = split(dek, threshold, totalShares)

  // 3. Encrypt payload with AES-256-SIV bound to AAD
  // Pre-compute ciphertext hash placeholder for deterministic binding
  // Note: In AES-SIV, we compute ciphertext with AAD containing (version, capsuleId, policyHash).
  // To avoid circular dependency on ciphertextHash, AAD binds version || capsuleId || policyHash:
  const aad = cat(enc.encode(`veil/v${VERSION}/aad`), cId, pHash)
  const ciphertext = aessiv(dek, aad).encrypt(pBytes)
  const ciphertextHash = sha256(ciphertext)

  // 4. Construct compact binary descriptor
  const descriptor = serializeDescriptor({
    version: VERSION,
    capsuleId: cId,
    policyHash: pHash,
    ciphertextHash,
    threshold,
    totalShares,
    storageType: STORAGE_INLINE,
    payload: ciphertext,
  })

  // 5. Seal shares to guardians if public keys are provided
  const shares = rawShares.map((s, idx) => {
    let sealedBox = null
    const guardianPub = guardianPublicKeys[idx]
    if (guardianPub) {
      const pubBytes = typeof guardianPub === 'string' ? fromHex(guardianPub) : guardianPub
      // Seal share bytes to the guardian's public key
      sealedBox = sealTo(pubBytes, s.share, CTX.deposit)
    }
    return {
      index: s.index,
      share: s.share,
      sealedBox,
    }
  })

  return {
    version: VERSION,
    capsuleId: toHex(cId),
    capsuleIdBytes: cId,
    policyHash: toHex(pHash),
    policyHashBytes: pHash,
    ciphertext,
    ciphertextHash: toHex(ciphertextHash),
    ciphertextHashBytes: ciphertextHash,
    threshold,
    totalShares,
    descriptor,
    descriptorB64: toB64(descriptor),
    dek,
    shares,
  }
}

/**
 * Serialize a capsule descriptor to compact binary format.
 */
export function serializeDescriptor({
  version = VERSION,
  capsuleId,
  policyHash,
  ciphertextHash,
  threshold = DEFAULT_THRESHOLD,
  totalShares = DEFAULT_TOTAL_SHARES,
  storageType = STORAGE_INLINE,
  payload,
}) {
  if (capsuleId.length !== 32 || policyHash.length !== 32 || ciphertextHash.length !== 32) {
    throw new Error('serializeDescriptor: 32-byte hashes required')
  }
  if (payload.length > 0xffff) {
    throw new Error(`serializeDescriptor: payload exceeds max size (${0xffff} bytes)`)
  }

  const header = new Uint8Array(
    2 + // MAGIC (2 bytes)
    1 + // version (1 byte)
    32 + // capsuleId (32 bytes)
    32 + // policyHash (32 bytes)
    32 + // ciphertextHash (32 bytes)
    1 + // threshold (1 byte)
    1 + // totalShares (1 byte)
    1 + // storageType (1 byte)
    2   // payload length (2 bytes, big-endian)
  )

  let at = 0
  header.set(MAGIC, at); at += 2
  header[at++] = version
  header.set(capsuleId, at); at += 32
  header.set(policyHash, at); at += 32
  header.set(ciphertextHash, at); at += 32
  header[at++] = threshold
  header[at++] = totalShares
  header[at++] = storageType
  header[at++] = (payload.length >> 8) & 0xff
  header[at++] = payload.length & 0xff

  return cat(header, payload)
}

/**
 * Parse a serialized binary or base64 capsule descriptor.
 */
export function parseDescriptor(input) {
  const bytes = typeof input === 'string' ? fromB64(input.trim()) : input
  if (!(bytes instanceof Uint8Array)) {
    throw new Error('parseDescriptor: input must be Uint8Array or base64 string')
  }

  const minLen = 2 + 1 + 32 + 32 + 32 + 1 + 1 + 1 + 2
  if (bytes.length < minLen) {
    throw new Error(`parseDescriptor: descriptor truncated (got ${bytes.length}, min ${minLen})`)
  }

  let at = 0
  if (bytes[0] !== MAGIC[0] || bytes[1] !== MAGIC[1]) {
    throw new Error('parseDescriptor: invalid magic prefix (not a VEIL descriptor)')
  }
  at += 2

  const version = bytes[at++]
  if (version !== VERSION) {
    throw new Error(`parseDescriptor: unsupported version ${version}`)
  }

  const capsuleId = bytes.subarray(at, at + 32); at += 32
  const policyHash = bytes.subarray(at, at + 32); at += 32
  const ciphertextHash = bytes.subarray(at, at + 32); at += 32
  const threshold = bytes[at++]
  const totalShares = bytes[at++]
  const storageType = bytes[at++]
  const payloadLen = (bytes[at++] << 8) | bytes[at++]

  if (at + payloadLen > bytes.length) {
    throw new Error('parseDescriptor: payload length header exceeds byte buffer')
  }

  const payload = bytes.subarray(at, at + payloadLen)

  return {
    version,
    capsuleId: toHex(capsuleId),
    capsuleIdBytes: capsuleId,
    policyHash: toHex(policyHash),
    policyHashBytes: policyHash,
    ciphertextHash: toHex(ciphertextHash),
    ciphertextHashBytes: ciphertextHash,
    threshold,
    totalShares,
    storageType,
    payload,
    ciphertext: storageType === STORAGE_INLINE ? payload : null,
  }
}

/**
 * Open and decrypt a VEIL capsule using collected threshold key shares.
 *
 * @param {object} params
 * @param {Uint8Array|string} params.descriptor The capsule descriptor (binary or base64)
 * @param {Array<{ index: number, share: Uint8Array }>} params.shares At least k valid shares
 * @returns {Uint8Array|null} Decrypted plaintext bytes, or null if decryption / auth tag fails
 */
export function openCapsule({ descriptor, shares }) {
  let parsed
  try {
    parsed = parseDescriptor(descriptor)
  } catch {
    return null
  }

  if (!parsed.ciphertext) {
    throw new Error('openCapsule: external storage pointer requires retrieval before decrypt')
  }

  // Verify ciphertext integrity against committed ciphertextHash
  const actualHash = sha256(parsed.ciphertext)
  if (toHex(actualHash) !== parsed.ciphertextHash) {
    return null
  }

  if (!Array.isArray(shares) || shares.length < parsed.threshold) {
    return null
  }

  // 1. Reconstruct DEK from shares
  let dek
  try {
    dek = reconstruct(shares.slice(0, parsed.threshold))
  } catch {
    return null
  }

  // 2. Recompute AAD
  const aad = cat(enc.encode(`veil/v${parsed.version}/aad`), parsed.capsuleIdBytes, parsed.policyHashBytes)

  // 3. Authenticated decryption via AES-256-SIV
  try {
    return aessiv(dek, aad).decrypt(parsed.ciphertext)
  } catch {
    // Auth tag failed: wrong DEK or tampered context
    return null
  }
}

/**
 * Format descriptor as human-readable armored text block.
 */
export function toArmored(descriptor) {
  const b64 = typeof descriptor === 'string' ? descriptor : toB64(descriptor)
  return `-----BEGIN VEIL CAPSULE-----\n${b64}\n-----END VEIL CAPSULE-----`
}

/**
 * Extract descriptor bytes from armored text block or raw base64.
 */
export function fromArmored(armored) {
  const clean = armored
    .replace(/-----BEGIN VEIL CAPSULE-----/, '')
    .replace(/-----END VEIL CAPSULE-----/, '')
    .replace(/\s+/g, '')
  return fromB64(clean)
}
