// Shamir's Secret Sharing (k-of-n) over Galois Field GF(256).
//
// Galois Field GF(2^8) arithmetic with standard primitive polynomial:
//   x^8 + x^4 + x^3 + x^2 + 1 (0x11d = 285, generator = 2)
//
// Properties:
//   - Byte-level evaluation: every byte of the secret is split independently.
//   - Zero size expansion: an N-byte secret yields N-byte shares.
//   - Information-theoretically secure: any k-1 shares reveal zero information about the secret.
//   - Minimal threshold: any k distinct shares reconstruct the exact secret.

const PRIMITIVE_POLY = 0x11d

// Exponential and logarithm tables for GF(256) multiplication/inversion
const EXP = new Uint8Array(512)
const LOG = new Uint8Array(256)

;(function initGF256() {
  let x = 1
  for (let i = 0; i < 255; i++) {
    EXP[i] = x
    LOG[x] = i
    x <<= 1
    if (x >= 256) x ^= PRIMITIVE_POLY
  }
  for (let i = 255; i < 512; i++) {
    EXP[i] = EXP[i - 255]
  }
})()

/** GF(256) addition / subtraction (XOR) */
export const gfAdd = (a, b) => a ^ b

/** GF(256) multiplication */
export function gfMul(a, b) {
  if (a === 0 || b === 0) return 0
  return EXP[LOG[a] + LOG[b]]
}

/** GF(256) multiplicative inverse (1 / a) */
export function gfInv(a) {
  if (a === 0) throw new Error('gfInv: division by zero')
  return EXP[255 - LOG[a]]
}

/** GF(256) division (a / b) */
export function gfDiv(a, b) {
  if (b === 0) throw new Error('gfDiv: division by zero')
  if (a === 0) return 0
  return EXP[(LOG[a] + 255 - LOG[b]) % 255]
}

/**
 * Split a secret byte array into n shares with threshold k.
 *
 * @param {Uint8Array} secret The secret to split (e.g. 32-byte or 64-byte DEK)
 * @param {number} k Threshold number of shares required to reconstruct (e.g. 2)
 * @param {number} n Total number of shares to generate (e.g. 3)
 * @returns {Array<{ index: number, share: Uint8Array }>} List of n shares with indices 1..n
 */
export function split(secret, k, n) {
  if (!(secret instanceof Uint8Array) || secret.length === 0) {
    throw new Error('split: secret must be a non-empty Uint8Array')
  }
  if (!Number.isInteger(k) || !Number.isInteger(n) || k < 1 || k > n || n > 255) {
    throw new Error(`split: invalid threshold parameters (k=${k}, n=${n}, max 255)`)
  }

  const len = secret.length
  const shares = Array.from({ length: n }, (_, i) => ({
    index: i + 1,
    share: new Uint8Array(len),
  }))

  // For each byte of the secret, generate random polynomial of degree k-1:
  // f(x) = secret_byte + a_1*x + a_2*x^2 + ... + a_{k-1}*x^{k-1}
  const randomCoeffs = crypto.getRandomValues(new Uint8Array((k - 1) * len))

  for (let byteIdx = 0; byteIdx < len; byteIdx++) {
    const s0 = secret[byteIdx]
    const coeffs = new Uint8Array(k)
    coeffs[0] = s0
    for (let c = 1; c < k; c++) {
      coeffs[c] = randomCoeffs[(c - 1) * len + byteIdx]
    }

    // Evaluate f(x) for x = 1..n
    for (let i = 0; i < n; i++) {
      const x = shares[i].index
      let val = coeffs[k - 1]
      for (let c = k - 2; c >= 0; c--) {
        val = gfAdd(gfMul(val, x), coeffs[c])
      }
      shares[i].share[byteIdx] = val
    }
  }

  return shares
}

/**
 * Reconstruct secret from any k distinct shares using Lagrange interpolation.
 *
 * @param {Array<{ index: number, share: Uint8Array }>} shares Array of at least k shares
 * @returns {Uint8Array} The reconstructed original secret
 */
export function reconstruct(shares) {
  if (!Array.isArray(shares) || shares.length === 0) {
    throw new Error('reconstruct: shares must be a non-empty array')
  }

  // Deduplicate and validate shares
  const seenIndices = new Set()
  const validShares = []
  for (const s of shares) {
    if (!s || typeof s.index !== 'number' || !(s.share instanceof Uint8Array)) {
      throw new Error('reconstruct: invalid share format')
    }
    if (s.index < 1 || s.index > 255) {
      throw new Error(`reconstruct: share index ${s.index} out of range (1..255)`)
    }
    if (!seenIndices.has(s.index)) {
      seenIndices.add(s.index)
      validShares.push(s)
    }
  }

  const len = validShares[0].share.length
  for (const s of validShares) {
    if (s.share.length !== len) {
      throw new Error('reconstruct: all shares must have equal length')
    }
  }

  const k = validShares.length
  const xs = validShares.map((s) => s.index)

  // Compute Lagrange basis polynomials evaluated at x = 0:
  // L_i(0) = \prod_{j \ne i} (0 - x_j) / (x_i - x_j) = \prod_{j \ne i} x_j / (x_i ^ x_j)
  const lagrangeWeights = new Uint8Array(k)
  for (let i = 0; i < k; i++) {
    let weight = 1
    const xi = xs[i]
    for (let j = 0; j < k; j++) {
      if (i === j) continue
      const xj = xs[j]
      const denom = gfAdd(xi, xj)
      if (denom === 0) throw new Error('reconstruct: duplicate share index detected')
      const factor = gfDiv(xj, denom)
      weight = gfMul(weight, factor)
    }
    lagrangeWeights[i] = weight
  }

  // Reconstruct each secret byte:
  // secret[b] = \sum_{i=0}^{k-1} y_i[b] * L_i(0)
  const secret = new Uint8Array(len)
  for (let byteIdx = 0; byteIdx < len; byteIdx++) {
    let val = 0
    for (let i = 0; i < k; i++) {
      const yi = validShares[i].share[byteIdx]
      val = gfAdd(val, gfMul(yi, lagrangeWeights[i]))
    }
    secret[byteIdx] = val
  }

  return secret
}
