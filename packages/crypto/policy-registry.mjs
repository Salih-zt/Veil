// VeilPolicyRegistry Contract Client & Canonical Policy Hashing SDK
//
// Interoperates with VeilPolicyRegistry.sol on EVM networks (Sepolia, Anvil, Local).
// Computes canonical policy hashes byte-identically with the smart contract.

import { encodeAbiParameters, keccak256 } from 'viem'

export { encodeAbiParameters, keccak256 }

export const REGISTRY_ABI = [
  {
    type: 'function',
    name: 'createCapsule',
    inputs: [
      { name: 'capsuleId', type: 'bytes32' },
      { name: 'ciphertextHash', type: 'bytes32' },
      { name: 'policyHash', type: 'bytes32' },
      { name: 'unlockTimestamp', type: 'uint64' },
      { name: 'expiryTimestamp', type: 'uint64' },
      { name: 'threshold', type: 'uint8' },
      { name: 'reviewers', type: 'address[]' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'approveRelease',
    inputs: [{ name: 'capsuleId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'revokeCapsule',
    inputs: [{ name: 'capsuleId', type: 'bytes32' }],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'authorizeRecipient',
    inputs: [
      { name: 'capsuleId', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
      { name: 'identityCommitment', type: 'bytes32' },
    ],
    outputs: [],
    stateMutability: 'nonpayable',
  },
  {
    type: 'function',
    name: 'isReleaseReady',
    inputs: [{ name: 'capsuleId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'isReleaseReadyForRecipient',
    inputs: [
      { name: 'capsuleId', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bool' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'recipientIdentityCommitment',
    inputs: [
      { name: 'capsuleId', type: 'bytes32' },
      { name: 'recipient', type: 'address' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getCapsule',
    inputs: [{ name: 'capsuleId', type: 'bytes32' }],
    outputs: [
      { name: 'creator', type: 'address' },
      { name: 'ciphertextHash', type: 'bytes32' },
      { name: 'policyHash', type: 'bytes32' },
      { name: 'unlockTimestamp', type: 'uint64' },
      { name: 'expiryTimestamp', type: 'uint64' },
      { name: 'threshold', type: 'uint8' },
      { name: 'approvalCount', type: 'uint8' },
      { name: 'revoked', type: 'bool' },
      { name: 'exists', type: 'bool' },
    ],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'getReviewers',
    inputs: [{ name: 'capsuleId', type: 'bytes32' }],
    outputs: [{ name: '', type: 'address[]' }],
    stateMutability: 'view',
  },
  {
    type: 'function',
    name: 'computePolicyHash',
    inputs: [
      { name: 'capsuleId', type: 'bytes32' },
      { name: 'ciphertextHash', type: 'bytes32' },
      { name: 'unlockTimestamp', type: 'uint64' },
      { name: 'expiryTimestamp', type: 'uint64' },
      { name: 'threshold', type: 'uint8' },
      { name: 'reviewers', type: 'address[]' },
    ],
    outputs: [{ name: '', type: 'bytes32' }],
    stateMutability: 'pure',
  },
]

/**
 * Compute the canonical policy hash matching VeilPolicyRegistry.computePolicyHash.
 *
 * @param {object} params
 * @param {`0x${string}`} params.capsuleId 32-byte hex string
 * @param {`0x${string}`} params.ciphertextHash 32-byte hex string (SHA-256 of ciphertext)
 * @param {number|bigint} params.unlockTimestamp Unix timestamp in seconds
 * @param {number|bigint} [params.expiryTimestamp=0] Unix timestamp in seconds (0 = no expiry)
 * @param {number} params.threshold Minimum reviewer approvals required (k)
 * @param {Array<`0x${string}`>} params.reviewers Array of reviewer EVM addresses
 * @returns {`0x${string}`} 32-byte keccak256 hash
 */
export function computeCanonicalPolicyHash({
  capsuleId,
  ciphertextHash = '0x0000000000000000000000000000000000000000000000000000000000000000',
  unlockTimestamp,
  expiryTimestamp = 0,
  threshold,
  reviewers,
}) {
  const normalizedReviewers = reviewers.map((r) => r.toLowerCase())
  const cleanCtHash = ciphertextHash
    ? (ciphertextHash.startsWith('0x') ? ciphertextHash : `0x${ciphertextHash}`)
    : '0x0000000000000000000000000000000000000000000000000000000000000000'

  const encoded = encodeAbiParameters(
    [
      { type: 'bytes32' },
      { type: 'bytes32' },
      { type: 'uint64' },
      { type: 'uint64' },
      { type: 'uint8' },
      { type: 'address[]' },
    ],
    [
      capsuleId.startsWith('0x') ? capsuleId : `0x${capsuleId}`,
      cleanCtHash,
      BigInt(unlockTimestamp),
      BigInt(expiryTimestamp),
      Number(threshold),
      normalizedReviewers,
    ],
  )

  return keccak256(encoded)
}

/**
 * Instantiate a typed client for VeilPolicyRegistry.
 *
 * @param {object} params
 * @param {import('viem').PublicClient} params.publicClient Viem public client
 * @param {import('viem').WalletClient} [params.walletClient] Optional Viem wallet client for write transactions
 * @param {`0x${string}`} params.registryAddress Deployed contract address
 */
export function createRegistryClient({ publicClient, walletClient = null, registryAddress }) {
  if (!publicClient) throw new Error('createRegistryClient: publicClient required')
  if (!registryAddress) throw new Error('createRegistryClient: registryAddress required')

  return {
    address: registryAddress,

    /** Check if all release conditions are met */
    async isReleaseReady(capsuleId) {
      return publicClient.readContract({
        address: registryAddress,
        abi: REGISTRY_ABI,
        functionName: 'isReleaseReady',
        args: [capsuleId],
      })
    },

    /** Check if release conditions and recipient authorization are met */
    async isReleaseReadyForRecipient(capsuleId, recipientAddress) {
      return publicClient.readContract({
        address: registryAddress,
        abi: REGISTRY_ABI,
        functionName: 'isReleaseReadyForRecipient',
        args: [capsuleId, recipientAddress],
      })
    },

    /** Retrieve identity commitment for recipient on capsule */
    async getRecipientIdentityCommitment(capsuleId, recipientAddress) {
      return publicClient.readContract({
        address: registryAddress,
        abi: REGISTRY_ABI,
        functionName: 'recipientIdentityCommitment',
        args: [capsuleId, recipientAddress],
      })
    },

    /** Retrieve full onchain capsule state */
    async getCapsule(capsuleId) {
      const res = await publicClient.readContract({
        address: registryAddress,
        abi: REGISTRY_ABI,
        functionName: 'getCapsule',
        args: [capsuleId],
      })
      return {
        creator: res[0],
        ciphertextHash: res[1],
        policyHash: res[2],
        unlockTimestamp: Number(res[3]),
        expiryTimestamp: Number(res[4]),
        threshold: Number(res[5]),
        approvalCount: Number(res[6]),
        revoked: res[7],
        exists: res[8],
      }
    },

    /** Retrieve registered reviewer addresses */
    async getReviewers(capsuleId) {
      return publicClient.readContract({
        address: registryAddress,
        abi: REGISTRY_ABI,
        functionName: 'getReviewers',
        args: [capsuleId],
      })
    },

    /** Register a new capsule onchain (requires walletClient) */
    async createCapsule({
      capsuleId,
      ciphertextHash,
      policyHash,
      unlockTimestamp,
      expiryTimestamp = 0,
      threshold,
      reviewers,
    }) {
      if (!walletClient) throw new Error('createCapsule: walletClient required for write transactions')
      const pHash =
        policyHash ??
        computeCanonicalPolicyHash({
          capsuleId,
          ciphertextHash,
          unlockTimestamp,
          expiryTimestamp,
          threshold,
          reviewers,
        })

      return walletClient.writeContract({
        address: registryAddress,
        abi: REGISTRY_ABI,
        functionName: 'createCapsule',
        args: [
          capsuleId,
          ciphertextHash,
          pHash,
          BigInt(unlockTimestamp),
          BigInt(expiryTimestamp),
          Number(threshold),
          reviewers,
        ],
      })
    },

    /** Submit reviewer approval for release (requires walletClient) */
    async approveRelease(capsuleId) {
      if (!walletClient) throw new Error('approveRelease: walletClient required for write transactions')
      return walletClient.writeContract({
        address: registryAddress,
        abi: REGISTRY_ABI,
        functionName: 'approveRelease',
        args: [capsuleId],
      })
    },

    /** Revoke a capsule (requires creator walletClient) */
    async revokeCapsule(capsuleId) {
      if (!walletClient) throw new Error('revokeCapsule: walletClient required for write transactions')
      return walletClient.writeContract({
        address: registryAddress,
        abi: REGISTRY_ABI,
        functionName: 'revokeCapsule',
        args: [capsuleId],
      })
    },

    /** Authorize recipient with identity commitment (requires creator walletClient) */
    async authorizeRecipient(capsuleId, recipientAddress, identityCommitment = '0x0000000000000000000000000000000000000000000000000000000000000000') {
      if (!walletClient) throw new Error('authorizeRecipient: walletClient required for write transactions')
      return walletClient.writeContract({
        address: registryAddress,
        abi: REGISTRY_ABI,
        functionName: 'authorizeRecipient',
        args: [capsuleId, recipientAddress, identityCommitment],
      })
    },
  }
}
