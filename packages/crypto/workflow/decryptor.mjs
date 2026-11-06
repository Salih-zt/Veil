// VEIL Local Recipient Decryption Engine (Bob)
//
// Executes strictly client-side authenticated decryption:
//   1. Receives sealed threshold shares from independent guardians.
//   2. Decrypts shares locally using recipient ephemeral X25519 private key.
//   3. Validates capsuleId and policy commitments.
//   4. Reconstructs 64-byte DEK via Shamir Secret Sharing (GF(256)).
//   5. Verifies ciphertext integrity and AES-256-SIV AEAD authentication tag.
//   6. Performs best-effort memory zeroization on transient key material.

import { reconstruct } from '../sss.mjs'
import { parseDescriptor } from '../capsule.mjs'
import { openBox, CTX } from '../gatebox.mjs'
import { aessiv } from '@noble/ciphers/aes.js'
import { sha256 } from '@noble/hashes/sha2.js'
import { toHex } from '../keys.mjs'

const enc = new TextEncoder()
const dec = new TextDecoder()

const cat = (...parts) => {
  const out = new Uint8Array(parts.reduce((a, p) => a + p.length, 0))
  let at = 0
  for (const p of parts) {
    out.set(p, at)
    at += p.length
  }
  return out
}

/**
 * Perform local client-side decryption of a VEIL capsule.
 *
 * @param {object} params
 * @param {Uint8Array|string} params.descriptor Binary or base64 descriptor
 * @param {Uint8Array} [params.ciphertext] Ciphertext (if external storage was used)
 * @param {Array<object>} params.guardianResponses Array of guardian release responses
 * @param {object} params.ephemeralKeypair Recipient ephemeral keypair { priv, pub }
 * @param {string} [params.expectedPolicyHash] Optional policy hash to verify
 * @returns {Promise<{ok: boolean, plaintext?: Uint8Array, text?: string, error?: string, reason?: string}>}
 */
export async function decryptCapsuleLocally({
  descriptor,
  ciphertext: externalCiphertext = null,
  guardianResponses = [],
  ephemeralKeypair,
  expectedPolicyHash = null,
}) {
  if (!descriptor || !ephemeralKeypair || !Array.isArray(guardianResponses)) {
    throw new Error('decryptCapsuleLocally: missing required decryption parameters')
  }

  // 1. Parse descriptor
  let parsed
  try {
    parsed = parseDescriptor(descriptor)
  } catch (err) {
    return { ok: false, error: 'INVALID_DESCRIPTOR', reason: err.message }
  }

  // 2. Validate policy hash commitment if provided
  if (expectedPolicyHash) {
    const cleanExpected = expectedPolicyHash.toLowerCase().replace(/^0x/, '')
    const cleanCommitted = parsed.policyHash.toLowerCase().replace(/^0x/, '')
    if (cleanExpected !== cleanCommitted) {
      return {
        ok: false,
        error: 'POLICY_HASH_MISMATCH',
        reason: `Committed policy (${cleanCommitted}) does not match expected (${cleanExpected})`,
      }
    }
  }

  // 3. Resolve and verify ciphertext
  const ciphertext = parsed.ciphertext || externalCiphertext
  if (!ciphertext) {
    return {
      ok: false,
      error: 'MISSING_CIPHERTEXT',
      reason: 'Ciphertext not present in descriptor or provided externally',
    }
  }

  const computedCiphertextHash = toHex(sha256(ciphertext))
  const cleanCommittedCiphertextHash = parsed.ciphertextHash.toLowerCase().replace(/^0x/, '')
  if (computedCiphertextHash !== cleanCommittedCiphertextHash) {
    return {
      ok: false,
      error: 'CIPHERTEXT_INTEGRITY_VIOLATION',
      reason: 'Ciphertext SHA-256 hash does not match descriptor commitment',
    }
  }

  // 4. Unseal guardian shares locally using ephemeral private key
  const rawShares = []
  for (const resp of guardianResponses) {
    if (resp && resp.sealedShare && resp.shareIndex !== undefined) {
      try {
        const opened = openBox(
          ephemeralKeypair.priv,
          ephemeralKeypair.pub,
          resp.sealedShare,
          CTX.release
        )
        if (opened instanceof Uint8Array && opened.length > 0) {
          rawShares.push({
            index: resp.shareIndex,
            share: opened,
          })
        }
      } catch {
        // Individual unseal failure ignored; quorum checked below
      }
    }
  }

  if (rawShares.length < parsed.threshold) {
    return {
      ok: false,
      error: 'INSUFFICIENT_VALID_SHARES',
      reason: `Successfully unsealed ${rawShares.length} shares, but threshold requires ${parsed.threshold}`,
    }
  }

  // 5. Reconstruct DEK in memory
  let dek = null
  let plaintext = null

  try {
    dek = reconstruct(rawShares.slice(0, parsed.threshold))

    // 6. Recompute canonical AAD
    const aad = cat(
      enc.encode(`veil/v${parsed.version}/aad`),
      parsed.capsuleIdBytes,
      parsed.policyHashBytes
    )

    // 7. Authenticated AES-256-SIV decryption
    plaintext = aessiv(dek, aad).decrypt(ciphertext)
    if (!plaintext) {
      return {
        ok: false,
        error: 'AEAD_AUTH_FAILED',
        reason: 'Ciphertext authentication tag verification failed',
      }
    }

    return {
      ok: true,
      plaintext,
      text: dec.decode(plaintext),
      capsuleId: `0x${parsed.capsuleId}`,
      sharesUsed: parsed.threshold,
    }
  } catch (err) {
    return {
      ok: false,
      error: 'DECRYPTION_ERROR',
      reason: err.message,
    }
  } finally {
    // 8. Best-effort memory zeroization of transient keys
    // Limitations Note: In JavaScript V8 runtimes, TypedArrays (.fill(0)) wipe the underlying ArrayBuffer.
    // However, transient variables or garbage-collected references cannot be hard-pinned or scrubbed
    // from OS virtual memory without native platform extensions.
    if (dek instanceof Uint8Array) {
      dek.fill(0)
    }
    for (const s of rawShares) {
      if (s.share instanceof Uint8Array) {
        s.share.fill(0)
      }
    }
  }
}
