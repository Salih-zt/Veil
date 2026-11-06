import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  createCapsule,
  serializeDescriptor,
  parseDescriptor,
  openCapsule,
  toArmored,
  fromArmored,
  MAGIC,
  VERSION,
} from '../../packages/crypto/capsule.mjs'
import { genKeyPair, toHex, fromHex } from '../../packages/crypto/keys.mjs'
import { openBox, CTX } from '../../packages/crypto/gatebox.mjs'

const enc = new TextEncoder()
const dec = new TextDecoder()

describe('VEIL Capsule Cryptography & Serialization', () => {
  it('creates and opens a capsule with any 2 of 3 shares', async () => {
    const secret = 'ETHGlobal Mumbai 2026: The secret winner is Project VEIL!'
    const policyHash = crypto.getRandomValues(new Uint8Array(32))

    const capsule = await createCapsule({
      plaintext: secret,
      policyHash,
      threshold: 2,
      totalShares: 3,
    })

    assert.equal(capsule.version, VERSION)
    assert.equal(typeof capsule.capsuleId, 'string')
    assert.equal(capsule.shares.length, 3)

    // Parse descriptor
    const parsed = parseDescriptor(capsule.descriptor)
    assert.equal(parsed.version, VERSION)
    assert.equal(parsed.capsuleId, capsule.capsuleId)
    assert.equal(parsed.policyHash, capsule.policyHash)
    assert.equal(parsed.ciphertextHash, capsule.ciphertextHash)

    // Open with shares 1 and 2
    const opened12 = openCapsule({
      descriptor: capsule.descriptor,
      shares: [capsule.shares[0], capsule.shares[1]],
    })
    assert.equal(dec.decode(opened12), secret)

    // Open with shares 1 and 3
    const opened13 = openCapsule({
      descriptor: capsule.descriptor,
      shares: [capsule.shares[0], capsule.shares[2]],
    })
    assert.equal(dec.decode(opened13), secret)

    // Open with shares 2 and 3
    const opened23 = openCapsule({
      descriptor: capsule.descriptor,
      shares: [capsule.shares[1], capsule.shares[2]],
    })
    assert.equal(dec.decode(opened23), secret)
  })

  it('fails closed when insufficient shares are provided', async () => {
    const secret = 'Confidential payload'
    const policyHash = crypto.getRandomValues(new Uint8Array(32))

    const capsule = await createCapsule({
      plaintext: secret,
      policyHash,
    })

    // Only 1 share (threshold is 2)
    const single = openCapsule({
      descriptor: capsule.descriptor,
      shares: [capsule.shares[0]],
    })
    assert.equal(single, null)

    // Zero shares
    const empty = openCapsule({
      descriptor: capsule.descriptor,
      shares: [],
    })
    assert.equal(empty, null)
  })

  it('fails closed when a share is tampered or corrupted', async () => {
    const secret = 'Do not tamper with this'
    const policyHash = crypto.getRandomValues(new Uint8Array(32))

    const capsule = await createCapsule({
      plaintext: secret,
      policyHash,
    })

    const corruptedShare = {
      index: capsule.shares[0].index,
      share: new Uint8Array(capsule.shares[0].share),
    }
    corruptedShare.share[5] ^= 0xff // corrupt byte

    const result = openCapsule({
      descriptor: capsule.descriptor,
      shares: [corruptedShare, capsule.shares[1]],
    })
    assert.equal(result, null)
  })

  it('fails closed if ciphertext is modified (tamper resistance)', async () => {
    const secret = 'Tamper-evident message'
    const policyHash = crypto.getRandomValues(new Uint8Array(32))

    const capsule = await createCapsule({
      plaintext: secret,
      policyHash,
    })

    // Modify a byte in the serialized ciphertext
    const tamperedDescriptor = new Uint8Array(capsule.descriptor)
    tamperedDescriptor[tamperedDescriptor.length - 1] ^= 0x01

    const result = openCapsule({
      descriptor: tamperedDescriptor,
      shares: [capsule.shares[0], capsule.shares[1]],
    })
    assert.equal(result, null)
  })

  it('fails closed if policyHash in descriptor is altered (AAD binding)', async () => {
    const secret = 'Bound to policy'
    const policyHash = crypto.getRandomValues(new Uint8Array(32))

    const capsule = await createCapsule({
      plaintext: secret,
      policyHash,
    })

    // Alter policyHash in descriptor (offset 35 to 67)
    const tamperedDescriptor = new Uint8Array(capsule.descriptor)
    tamperedDescriptor[35] ^= 0x01

    const result = openCapsule({
      descriptor: tamperedDescriptor,
      shares: [capsule.shares[0], capsule.shares[1]],
    })
    assert.equal(result, null)
  })

  it('seals key shares to guardian public keys', async () => {
    const secret = 'Guardian-held shares'
    const policyHash = crypto.getRandomValues(new Uint8Array(32))

    // 3 Guardians with X25519 keypairs
    const g1 = genKeyPair()
    const g2 = genKeyPair()
    const g3 = genKeyPair()

    const capsule = await createCapsule({
      plaintext: secret,
      policyHash,
      guardianPublicKeys: [g1.pub, g2.pub, g3.pub],
    })

    // Each share has a sealedBox for its guardian
    assert.ok(capsule.shares[0].sealedBox)
    assert.ok(capsule.shares[1].sealedBox)
    assert.ok(capsule.shares[2].sealedBox)

    // Guardian 1 decrypts share 1
    const unsealedShare1 = openBox(g1.priv, g1.pub, capsule.shares[0].sealedBox, CTX.deposit)
    assert.deepEqual(unsealedShare1, capsule.shares[0].share)

    // Guardian 2 decrypts share 2
    const unsealedShare2 = openBox(g2.priv, g2.pub, capsule.shares[1].sealedBox, CTX.deposit)
    assert.deepEqual(unsealedShare2, capsule.shares[1].share)

    // Wrong guardian key fails
    const failOpen = openBox(g1.priv, g1.pub, capsule.shares[1].sealedBox, CTX.deposit)
    assert.equal(failOpen, null)

    // Recipient can open capsule using unsealed shares from Guardian 1 and 2
    const opened = openCapsule({
      descriptor: capsule.descriptor,
      shares: [
        { index: 1, share: unsealedShare1 },
        { index: 2, share: unsealedShare2 },
      ],
    })
    assert.equal(dec.decode(opened), secret)
  })

  it('supports armored ASCII export and import', async () => {
    const secret = 'ASCII armored capsule'
    const policyHash = crypto.getRandomValues(new Uint8Array(32))

    const capsule = await createCapsule({
      plaintext: secret,
      policyHash,
    })

    const armored = toArmored(capsule.descriptor)
    assert.ok(armored.startsWith('-----BEGIN VEIL CAPSULE-----'))
    assert.ok(armored.endsWith('-----END VEIL CAPSULE-----'))

    const recoveredBytes = fromArmored(armored)
    assert.deepEqual(recoveredBytes, capsule.descriptor)

    const opened = openCapsule({
      descriptor: recoveredBytes,
      shares: [capsule.shares[0], capsule.shares[1]],
    })
    assert.equal(dec.decode(opened), secret)
  })
})
