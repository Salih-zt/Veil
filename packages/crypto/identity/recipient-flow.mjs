// VEIL Recipient Disclosure & Retrieval Engine (Phase 5)
//
// Orchestrates the end-to-end recipient workflow:
//   1. Parses capsule descriptor to extract capsuleId, policyHash, and threshold.
//   2. Generates fresh ephemeral X25519 disclosure keypair.
//   3. Signs canonical release request binding identity proofs and ephemeral public key.
//   4. Concurrently queries independent guardians for sealed Shamir shares.
//   5. Decrypts sealed shares with recipient ephemeral private key.
//   6. Reconstructs DEK via Shamir's Secret Sharing over GF(256).
//   7. Authenticates and decrypts capsule ciphertext under AES-256-SIV.

import { genKeyPair, toHex } from '../keys.mjs'
import { openBox, CTX } from '../gatebox.mjs'
import { parseDescriptor, openCapsule } from '../capsule.mjs'
import { signReleaseRequestV2 } from './recipient-auth.mjs'

const dec = new TextDecoder()

/**
 * Retrieve shares from independent guardians and decrypt a VEIL capsule.
 *
 * @param {object} params
 * @param {Uint8Array|string} params.descriptor The capsule descriptor (binary or base64)
 * @param {object} params.account Viem account signer (with .address and .signMessage)
 * @param {Array<object>} params.guardians Array of guardian instances (with .release() method)
 * @param {object} [params.worldProof] Optional World ID 4.0 proof
 * @param {object} [params.orgCredential] Optional organizational role credential
 * @param {number} [params.chainId=31337] EVM chain ID
 * @param {`0x${string}`} [params.registryAddress] Deployed VeilPolicyRegistry address
 * @param {number} [params.ttlMs=300000] Request TTL in milliseconds (5 minutes)
 * @returns {Promise<{ok: boolean, plaintext?: Uint8Array, text?: string, error?: string, reason?: string, shareCount?: number}>}
 */
export async function retrieveAndOpenCapsule({
  descriptor,
  account,
  guardians,
  worldProof = null,
  orgCredential = null,
  chainId = 31337,
  registryAddress = null,
  ttlMs = 5 * 60 * 1000,
}) {
  if (!descriptor || !account || !Array.isArray(guardians) || guardians.length === 0) {
    throw new Error('retrieveAndOpenCapsule: descriptor, account, and guardians array are required')
  }

  // 1. Parse descriptor
  let parsed
  try {
    parsed = parseDescriptor(descriptor)
  } catch (err) {
    return { ok: false, error: 'INVALID_DESCRIPTOR', reason: err.message }
  }

  // 2. Generate fresh ephemeral X25519 keypair
  const { priv: ephemeralPriv, pub: ephemeralPub } = genKeyPair()
  const ephemeralPubHex = toHex(ephemeralPub)

  // Resolve dynamic World ID proof if generator function provided
  const effectiveWorldProof = typeof worldProof === 'function'
    ? await worldProof({
        recipient: account.address,
        recipientPub: ephemeralPubHex,
        capsuleId: parsed.capsuleId,
      })
    : worldProof

  // 3. Sign canonical recipient authorization request
  const signedReq = await signReleaseRequestV2({
    account,
    chainId,
    registryAddress,
    capsuleId: parsed.capsuleId,
    policyHash: parsed.policyHash,
    recipientPub: ephemeralPubHex,
    worldProof: effectiveWorldProof,
    orgCredential,
    ttlMs,
  })

  // 4. Concurrently request shares from available guardians
  const sharePromises = guardians.map(async (g) => {
    try {
      const res = await g.release({
        capsuleId: parsed.capsuleId,
        recipient: account.address,
        recipientPub: ephemeralPubHex,
        nonce: signedReq.nonce,
        expiry: signedReq.expiry,
        signature: signedReq.signature,
        chainId,
        registryAddress,
        policyHash: parsed.policyHash,
        worldProof: effectiveWorldProof,
        orgCredential,
      })

      if (!res || !res.ok || !res.sealedShare) {
        return null
      }

      // Decrypt sealed share with ephemeral private key
      const rawShare = openBox(ephemeralPriv, ephemeralPub, res.sealedShare, CTX.release)
      if (!rawShare) {
        return null
      }

      return {
        index: res.shareIndex,
        share: rawShare,
      }
    } catch {
      return null
    }
  })

  const results = await Promise.all(sharePromises)
  const collectedShares = results.filter(Boolean)

  if (collectedShares.length < parsed.threshold) {
    return {
      ok: false,
      error: 'INSUFFICIENT_SHARES',
      reason: `Collected ${collectedShares.length} shares, but threshold requires ${parsed.threshold}`,
      shareCount: collectedShares.length,
    }
  }

  // 5. Open and decrypt capsule
  const plaintext = openCapsule({
    descriptor,
    shares: collectedShares,
  })

  if (!plaintext) {
    return {
      ok: false,
      error: 'DECRYPTION_FAILED',
      reason: 'Failed to decrypt capsule: AEAD authentication tag check failed',
    }
  }

  return {
    ok: true,
    plaintext,
    text: dec.decode(plaintext),
    shareCount: collectedShares.length,
  }
}
