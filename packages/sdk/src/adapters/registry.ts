// VEIL Protocol SDK — Onchain Registry Adapter

import type { VeilRegistryAdapter, VeilWalletAdapter } from '../types/index.js'
import { REGISTRY_ABI } from '../../../crypto/policy-registry.mjs'
import { TransactionError } from '../errors/index.js'

export class ViemRegistryAdapter implements VeilRegistryAdapter {
  public readonly address: `0x${string}`
  private readonly publicClient: any
  private readonly defaultWallet?: VeilWalletAdapter

  constructor(params: {
    address: `0x${string}` | string
    publicClient: any
    defaultWallet?: VeilWalletAdapter
  }) {
    this.address = (params.address.startsWith('0x') ? params.address : `0x${params.address}`) as `0x${string}`
    this.publicClient = params.publicClient
    this.defaultWallet = params.defaultWallet
  }

  async getCapsule(capsuleId: string): Promise<any> {
    const cId = capsuleId.startsWith('0x') ? capsuleId : `0x${capsuleId}`
    if (this.publicClient.readContract) {
      return this.publicClient.readContract({
        address: this.address,
        abi: REGISTRY_ABI,
        functionName: 'getCapsule',
        args: [cId],
      })
    }
    return this.publicClient.getCapsule(cId)
  }

  async getReviewers(capsuleId: string): Promise<`0x${string}`[]> {
    const cId = capsuleId.startsWith('0x') ? capsuleId : `0x${capsuleId}`
    if (this.publicClient.readContract) {
      return this.publicClient.readContract({
        address: this.address,
        abi: REGISTRY_ABI,
        functionName: 'getReviewers',
        args: [cId],
      })
    }
    return this.publicClient.getReviewers(cId)
  }

  async isReleaseReady(capsuleId: string): Promise<boolean> {
    const cId = capsuleId.startsWith('0x') ? capsuleId : `0x${capsuleId}`
    if (this.publicClient.readContract) {
      return this.publicClient.readContract({
        address: this.address,
        abi: REGISTRY_ABI,
        functionName: 'isReleaseReady',
        args: [cId],
      })
    }
    return this.publicClient.isReleaseReady(cId)
  }

  async isReleaseReadyForRecipient(capsuleId: string, recipient: string): Promise<boolean> {
    const cId = capsuleId.startsWith('0x') ? capsuleId : `0x${capsuleId}`
    const rcpt = recipient.startsWith('0x') ? recipient : `0x${recipient}`
    if (this.publicClient.readContract) {
      return this.publicClient.readContract({
        address: this.address,
        abi: REGISTRY_ABI,
        functionName: 'isReleaseReadyForRecipient',
        args: [cId, rcpt],
      })
    }
    return this.publicClient.isReleaseReadyForRecipient(cId, rcpt)
  }

  async recipientIdentityCommitment(capsuleId: string, recipient: string): Promise<`0x${string}`> {
    const cId = capsuleId.startsWith('0x') ? capsuleId : `0x${capsuleId}`
    const rcpt = recipient.startsWith('0x') ? recipient : `0x${recipient}`
    if (this.publicClient.readContract) {
      return this.publicClient.readContract({
        address: this.address,
        abi: REGISTRY_ABI,
        functionName: 'recipientIdentityCommitment',
        args: [cId, rcpt],
      })
    }
    return this.publicClient.recipientIdentityCommitment(cId, rcpt)
  }

  async createCapsule(params: {
    capsuleId: string
    ciphertextHash: string
    policyHash: string
    unlockTimestamp: number
    expiryTimestamp: number
    threshold: number
    reviewers: string[]
  }, signer?: VeilWalletAdapter): Promise<`0x${string}`> {
    const wallet = signer || this.defaultWallet
    if (!wallet && !this.publicClient.createCapsule) {
      throw new TransactionError('createCapsule', 'No signer wallet or createCapsule client method available')
    }

    if (this.publicClient.createCapsule) {
      return this.publicClient.createCapsule(params)
    }

    throw new TransactionError('createCapsule', 'Direct contract write requires walletClient integration')
  }

  async approveRelease(capsuleId: string, signer?: VeilWalletAdapter): Promise<`0x${string}`> {
    const wallet = signer || this.defaultWallet
    const cId = capsuleId.startsWith('0x') ? capsuleId : `0x${capsuleId}`

    if (!wallet && !this.publicClient.approveRelease) {
      throw new TransactionError('approveRelease', 'Signer wallet is required to sign onchain approval')
    }

    if (this.publicClient.approveRelease) {
      return this.publicClient.approveRelease(cId)
    }

    throw new TransactionError('approveRelease', 'Contract write requires wallet client')
  }

  async authorizeRecipient(capsuleId: string, recipient: string, commitment: string, signer?: VeilWalletAdapter): Promise<`0x${string}`> {
    const wallet = signer || this.defaultWallet
    const cId = capsuleId.startsWith('0x') ? capsuleId : `0x${capsuleId}`
    const rcpt = recipient.startsWith('0x') ? recipient : `0x${recipient}`

    if (!wallet && !this.publicClient.authorizeRecipient) {
      throw new TransactionError('authorizeRecipient', 'Signer wallet is required to authorize recipient onchain')
    }

    if (this.publicClient.authorizeRecipient) {
      return this.publicClient.authorizeRecipient(cId, rcpt, commitment)
    }

    throw new TransactionError('authorizeRecipient', 'Contract write requires wallet client')
  }

  async revokeCapsule(capsuleId: string, signer?: VeilWalletAdapter): Promise<`0x${string}`> {
    const wallet = signer || this.defaultWallet
    const cId = capsuleId.startsWith('0x') ? capsuleId : `0x${capsuleId}`

    if (!wallet && !this.publicClient.revokeCapsule) {
      throw new TransactionError('revokeCapsule', 'Signer wallet is required to revoke capsule onchain')
    }

    if (this.publicClient.revokeCapsule) {
      return this.publicClient.revokeCapsule(cId)
    }

    throw new TransactionError('revokeCapsule', 'Contract write requires wallet client')
  }
}
