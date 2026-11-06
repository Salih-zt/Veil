// VEIL Capsule Detection & Inspection Workflow (Bob)
//
// Implements the recipient-side detection pipeline:
//   1. Accepts pasted carrier text, ASCII armor, or raw descriptor bytes.
//   2. Distinguishes ordinary conversation text from structured carrier text.
//   3. Decodes carrier text back into binary capsule descriptor.
//   4. Validates descriptor structure, MAGIC bytes, and format version.
//   5. Retrieves and verifies encrypted ciphertext against committed ciphertextHash.
//   6. Fetches onchain policy status from VeilPolicyRegistry.
//   7. Evaluates recipient-specific authorization and release readiness.
//   8. Computes objective lifecycle status without prematurely attempting decryption.

import { parseDescriptor, MAGIC, VERSION } from '../capsule.mjs'
import { decodeFromCarrierText, isCarrierText } from '../codec/wordmap.mjs'
import { defaultStorage } from '../storage/storage.mjs'
import { deriveAuthoritativeStatus, CAPSULE_STATES } from '../lifecycle.mjs'
import { toHex, fromHex } from '../keys.mjs'
import { sha256 } from '@noble/hashes/sha2.js'

/**
 * Detect and inspect a capsule from pasted carrier text or raw input.
 *
 * @param {object} params
 * @param {string|Uint8Array} params.input Pasted carrier text, base64, or Uint8Array
 * @param {string} [params.recipientAddress] Connected recipient wallet address
 * @param {object} [params.registryClient] Onchain policy registry client
 * @param {object} [params.storage=defaultStorage] Ciphertext storage driver
 * @param {number} [params.nowSec] Clock source in seconds
 * @returns {Promise<object>} Detailed capsule inspection and requirement summary
 */
export async function detectAndInspectCapsule({
  input,
  recipientAddress = null,
  registryClient = null,
  storage = defaultStorage,
  nowSec = Math.floor(Date.now() / 1000),
}) {
  if (!input) {
    return { detected: false, status: 'NO_INPUT', reason: 'No input provided' }
  }

  // 1. Determine input format and decode to descriptor bytes
  let descriptorBytes = null
  let detectedFormat = null

  if (input instanceof Uint8Array) {
    descriptorBytes = input
    detectedFormat = 'binary'
  } else if (typeof input === 'string') {
    const trimmed = input.trim()

    // Check for carrier text (words from 256-word dictionary)
    if (isCarrierText(trimmed)) {
      try {
        descriptorBytes = decodeFromCarrierText(trimmed)
        detectedFormat = 'carrier_text'
      } catch {
        // Not valid carrier text
      }
    }

    // Check for base64 / armored envelope if not carrier text
    if (!descriptorBytes) {
      try {
        const cleanB64 = trimmed
          .replace(/-----BEGIN VEIL CAPSULE-----/, '')
          .replace(/-----END VEIL CAPSULE-----/, '')
          .replace(/\s+/g, '')
        const buf = Buffer.from(cleanB64, 'base64')
        if (buf.length >= 104 && buf[0] === MAGIC[0] && buf[1] === MAGIC[1]) {
          descriptorBytes = new Uint8Array(buf)
          detectedFormat = 'base64'
        }
      } catch {
        // Not valid base64
      }
    }
  }

  // If input could not be decoded to descriptor bytes
  if (!descriptorBytes) {
    return {
      detected: false,
      status: 'NO_CAPSULE_DETECTED',
      reason: 'Input is ordinary natural-language text; no VEIL capsule detected',
    }
  }

  // 2. Parse descriptor structure
  let parsed
  try {
    parsed = parseDescriptor(descriptorBytes)
  } catch (err) {
    return {
      detected: true,
      valid: false,
      status: 'INVALID_DESCRIPTOR',
      reason: `Descriptor parsing failed: ${err.message}`,
    }
  }

  const capsuleId = parsed.capsuleId.startsWith('0x') ? parsed.capsuleId : `0x${parsed.capsuleId}`
  const policyHash = parsed.policyHash.startsWith('0x') ? parsed.policyHash : `0x${parsed.policyHash}`
  const ciphertextHash = parsed.ciphertextHash.startsWith('0x') ? parsed.ciphertextHash : `0x${parsed.ciphertextHash}`

  // 3. Retrieve and verify ciphertext
  let ciphertext = parsed.ciphertext
  let storageRef = null
  if (!ciphertext && storage) {
    storageRef = `veil://local/${parsed.ciphertextHash.toLowerCase().replace(/^0x/, '')}`
    try {
      ciphertext = await storage.retrieve({
        storageRef,
        expectedCiphertextHash: ciphertextHash,
      })
    } catch {
      // Storage lookup failed
    }
  }

  // Verify ciphertext integrity
  let ciphertextVerified = false
  if (ciphertext) {
    const actualHash = `0x${toHex(sha256(ciphertext))}`
    ciphertextVerified = actualHash.toLowerCase() === ciphertextHash.toLowerCase()
  }

  // 4. Query onchain policy registry if available
  let onchainState = null
  let isReleaseReady = false
  let isRecipientAuthorizedOnchain = false

  if (registryClient) {
    try {
      onchainState = await registryClient.getCapsule(capsuleId)
      isReleaseReady = await registryClient.isReleaseReady(capsuleId)

      if (recipientAddress) {
        isRecipientAuthorizedOnchain = await registryClient.isReleaseReadyForRecipient(
          capsuleId,
          recipientAddress
        )
      }
    } catch {
      // Registry lookup failed
    }
  }

  // 5. Derive authoritative lifecycle status
  const status = deriveAuthoritativeStatus({
    onchainState,
    isRecipientAuthorizedOnchain,
    threshold: parsed.threshold,
    nowSec,
  })

  // 6. Access requirement summary
  const unlockSec = onchainState ? Number(onchainState.unlockTimestamp) : 0
  const expirySec = onchainState ? Number(onchainState.expiryTimestamp) : 0
  const approvals = onchainState ? Number(onchainState.approvalCount) : 0
  const threshold = onchainState ? Number(onchainState.threshold) : parsed.threshold

  const requirementsSummary = {
    unlockTimestamp: unlockSec,
    unlockDate: unlockSec ? new Date(unlockSec * 1000).toISOString() : 'Immediate',
    timeSatisfied: unlockSec === 0 || nowSec >= unlockSec,
    expiryTimestamp: expirySec,
    expiryDate: expirySec ? new Date(expirySec * 1000).toISOString() : 'Never',
    expired: expirySec !== 0 && nowSec > expirySec,
    approvalsCurrent: approvals,
    approvalsRequired: threshold,
    quorumSatisfied: approvals >= threshold,
    recipientAddress,
    recipientAuthorizedOnchain: isRecipientAuthorizedOnchain,
  }

  return {
    detected: true,
    valid: true,
    format: detectedFormat,
    status,
    capsuleId,
    policyHash,
    ciphertextHash,
    ciphertextVerified,
    threshold: parsed.threshold,
    totalShares: parsed.totalShares,
    descriptor: descriptorBytes,
    ciphertext,
    onchainState,
    isReleaseReady,
    requirements: requirementsSummary,
  }
}
