import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import {
  computeCanonicalPolicyHash,
  REGISTRY_ABI,
  createRegistryClient,
  encodeAbiParameters,
  keccak256,
} from '../../packages/crypto/policy-registry.mjs'
import { createCapsule, parseDescriptor, openCapsule } from '../../packages/crypto/capsule.mjs'

describe('VeilPolicyRegistry SDK Client & Canonical Policy Hashing', () => {
  it('computes canonical policy hash with exact ABI encoding', () => {
    const params = {
      capsuleId: '0x1111111111111111111111111111111111111111111111111111111111111111',
      ciphertextHash: '0x2222222222222222222222222222222222222222222222222222222222222222',
      unlockTimestamp: 1735689600, // 2025-01-01 00:00:00 UTC
      expiryTimestamp: 1738368000, // 2025-02-01 00:00:00 UTC
      threshold: 2,
      reviewers: [
        '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
        '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
        '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
      ],
    }

    const hash = computeCanonicalPolicyHash(params)
    assert.match(hash, /^0x[0-9a-f]{64}$/)

    // Direct Viem reference encoding verification
    const expected = keccak256(
      encodeAbiParameters(
        [
          { type: 'bytes32' },
          { type: 'bytes32' },
          { type: 'uint64' },
          { type: 'uint64' },
          { type: 'uint8' },
          { type: 'address[]' },
        ],
        [
          params.capsuleId,
          params.ciphertextHash,
          BigInt(params.unlockTimestamp),
          BigInt(params.expiryTimestamp),
          params.threshold,
          params.reviewers.map((r) => r.toLowerCase()),
        ],
      ),
    )

    assert.equal(hash, expected)
  })

  it('canonical policy hash integrates with createCapsule and openCapsule', async () => {
    const capsuleId = '0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa'
    const secret = 'Confidential Hackathon Results: Alice, Bob, Charlie win 1st Place!'

    // First, generate placeholder or known parameters
    const unlockTimestamp = Math.floor(Date.now() / 1000) + 3600
    const expiryTimestamp = unlockTimestamp + 86400
    const threshold = 2
    const reviewers = [
      '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
      '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
      '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    ]

    // Create capsule without pre-computing ciphertextHash first to obtain ciphertext
    const dummyHash = '0x0000000000000000000000000000000000000000000000000000000000000000'
    const prelim = await createCapsule({
      plaintext: secret,
      policyHash: dummyHash,
      capsuleId,
      threshold,
      totalShares: 3,
    })

    // Now compute canonical policy hash over the actual ciphertextHash
    const policyHash = computeCanonicalPolicyHash({
      capsuleId,
      ciphertextHash: `0x${prelim.ciphertextHash}`,
      unlockTimestamp,
      expiryTimestamp,
      threshold,
      reviewers,
    })

    // Create the final production capsule with the bound policy hash
    const finalCapsule = await createCapsule({
      plaintext: secret,
      policyHash,
      capsuleId,
      threshold,
      totalShares: 3,
    })

    const parsed = parseDescriptor(finalCapsule.descriptor)
    assert.equal(`0x${parsed.policyHash}`, policyHash)
    assert.equal(`0x${parsed.ciphertextHash}`, `0x${finalCapsule.ciphertextHash}`)

    // Verify decryption with shares (1, 2)
    const decrypted = openCapsule({
      descriptor: finalCapsule.descriptor,
      shares: [finalCapsule.shares[0], finalCapsule.shares[1]],
    })
    assert.equal(new TextDecoder().decode(decrypted), secret)
  })

  it('exposes typed ABI functions in createRegistryClient', () => {
    const mockPublicClient = {
      readContract: async ({ functionName, args }) => {
        if (functionName === 'isReleaseReady') return true
        if (functionName === 'getCapsule') {
          return [
            '0xA11CE00000000000000000000000000000000000',
            '0x1111111111111111111111111111111111111111111111111111111111111111',
            '0x2222222222222222222222222222222222222222222222222222222222222222',
            1735689600n,
            1738368000n,
            2,
            2,
            false,
            true,
          ]
        }
        return null
      },
    }

    const client = createRegistryClient({
      publicClient: mockPublicClient,
      registryAddress: '0x1234567890123456789012345678901234567890',
    })

    assert.equal(typeof client.isReleaseReady, 'function')
    assert.equal(typeof client.getCapsule, 'function')
    assert.equal(typeof client.createCapsule, 'function')
    assert.equal(typeof client.approveRelease, 'function')
    assert.equal(typeof client.revokeCapsule, 'function')
    assert.equal(typeof client.authorizeRecipient, 'function')
  })
})
