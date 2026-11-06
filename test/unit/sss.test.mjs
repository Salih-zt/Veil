import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { split, reconstruct, gfAdd, gfMul, gfInv, gfDiv } from '../../packages/crypto/sss.mjs'

describe('Shamir Secret Sharing GF(256) arithmetic', () => {
  it('addition and subtraction are identical and invert themselves (XOR)', () => {
    assert.equal(gfAdd(42, 42), 0)
    assert.equal(gfAdd(0xab, 0xcd), 0xab ^ 0xcd)
  })

  it('multiplication and inversion behave as a field', () => {
    for (let a = 1; a < 256; a++) {
      const invA = gfInv(a)
      assert.equal(gfMul(a, invA), 1, `inv failed for ${a}`)
    }
  })

  it('division matches multiplication by inverse', () => {
    for (let a = 1; a < 256; a += 17) {
      for (let b = 1; b < 256; b += 23) {
        assert.equal(gfDiv(a, b), gfMul(a, gfInv(b)))
      }
    }
  })
})

describe('2-of-3 Threshold Secret Sharing', () => {
  it('reconstructs from any 2 of 3 shares', () => {
    const secret = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 42, 255, 0, 128])
    const shares = split(secret, 2, 3)

    assert.equal(shares.length, 3)
    assert.deepEqual(shares.map((s) => s.index), [1, 2, 3])
    for (const s of shares) {
      assert.equal(s.share.length, secret.length)
    }

    // Shares (1, 2)
    assert.deepEqual(reconstruct([shares[0], shares[1]]), secret)

    // Shares (1, 3)
    assert.deepEqual(reconstruct([shares[0], shares[2]]), secret)

    // Shares (2, 3)
    assert.deepEqual(reconstruct([shares[1], shares[2]]), secret)

    // All 3 shares (1, 2, 3)
    assert.deepEqual(reconstruct(shares), secret)
  })

  it('reconstructs standard 64-byte AES-256-SIV keys', () => {
    const key = crypto.getRandomValues(new Uint8Array(64))
    const shares = split(key, 2, 3)

    const rec12 = reconstruct([shares[0], shares[1]])
    const rec23 = reconstruct([shares[1], shares[2]])
    const rec13 = reconstruct([shares[0], shares[2]])

    assert.deepEqual(rec12, key)
    assert.deepEqual(rec23, key)
    assert.deepEqual(rec13, key)
  })

  it('a single share does NOT yield the secret', () => {
    const secret = crypto.getRandomValues(new Uint8Array(32))
    const shares = split(secret, 2, 3)

    const single = reconstruct([shares[0]])
    assert.notDeepEqual(single, secret)
  })

  it('a tampered share does NOT yield the original secret', () => {
    const secret = crypto.getRandomValues(new Uint8Array(32))
    const shares = split(secret, 2, 3)

    const tampered = {
      index: shares[0].index,
      share: new Uint8Array(shares[0].share),
    }
    tampered.share[0] ^= 0x01

    const rec = reconstruct([tampered, shares[1]])
    assert.notDeepEqual(rec, secret)
  })

  it('supports general k-of-n (e.g. 3-of-5)', () => {
    const secret = crypto.getRandomValues(new Uint8Array(48))
    const shares = split(secret, 3, 5)

    assert.equal(shares.length, 5)

    // Any 3 shares
    assert.deepEqual(reconstruct([shares[0], shares[1], shares[2]]), secret)
    assert.deepEqual(reconstruct([shares[0], shares[2], shares[4]]), secret)
    assert.deepEqual(reconstruct([shares[1], shares[3], shares[4]]), secret)

    // Any 2 shares is insufficient
    assert.notDeepEqual(reconstruct([shares[0], shares[1]]), secret)
  })

  it('round-trips 100 random secrets across variable byte lengths', () => {
    for (let i = 0; i < 100; i++) {
      const len = 1 + (i % 80)
      const secret = crypto.getRandomValues(new Uint8Array(len))
      const shares = split(secret, 2, 3)
      const subset = [shares[i % 3], shares[(i + 1) % 3]]
      const rec = reconstruct(subset)
      assert.deepEqual(rec, secret)
    }
  })
})
