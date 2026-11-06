// VEIL Protocol SDK — Recipient Authorization Module

import { keccak256, encodeAbiParameters } from 'viem'
import { toHex, genKeyPair } from '../../../crypto/keys.mjs'
import { signReleaseRequestV2 } from '../../../crypto/identity/recipient-auth.mjs'
import type {
  RecipientAuthorizeInput,
  RecipientAuthorizeResult,
  VeilRegistryAdapter,
  VeilWalletAdapter,
  VeilIdentityAdapter,
} from '../types/index.js'
import {
  IdentityVerificationError,
  InvalidParameterError,
} from '../errors/index.js'

export class RecipientManager {
  private readonly registry: VeilRegistryAdapter
  private readonly defaultWallet?: VeilWalletAdapter
  private readonly identityAdapter?: VeilIdentityAdapter

  constructor(params: {
    registry: VeilRegistryAdapter
    defaultWallet?: VeilWalletAdapter
    identityAdapter?: VeilIdentityAdapter
  }) {
    this.registry = params.registry
    this.defaultWallet = params.defaultWallet
    this.identityAdapter = params.identityAdapter
  }

  /**
   * Authorize a recipient address onchain with an identity commitment.
   */
  async authorize(input: RecipientAuthorizeInput): Promise<RecipientAuthorizeResult> {
    if (!input || !input.capsuleId) {
      throw new InvalidParameterError('capsuleId', 'Capsule ID is required')
    }

    const wallet = input.signer || this.defaultWallet
    if (!wallet) {
      throw new InvalidParameterError('signer', 'Wallet signer is required to authorize recipient')
    }

    const recipientAddress = await wallet.getAddress()
    const cId = input.capsuleId.startsWith('0x') ? input.capsuleId : `0x${input.capsuleId}`

    // Compute identity commitment from proofs if present
    let identityCommitment = '0x0000000000000000000000000000000000000000000000000000000000000000' as `0x${string}`

    if (input.identityProof || input.organizationCredential) {
      const nullifier = input.identityProof?.responses?.[0]?.nullifier || '0x0000000000000000000000000000000000000000000000000000000000000000'
      const orgId = input.organizationCredential?.orgId || ''
      const role = input.organizationCredential?.role || ''

      const cleanNullifier = nullifier.startsWith('0x') ? nullifier : `0x${nullifier}`
      identityCommitment = keccak256(
        encodeAbiParameters(
          [{ type: 'bytes32' }, { type: 'string' }, { type: 'string' }],
          [cleanNullifier as `0x${string}`, orgId, role]
        )
      )
    }

    const txHash = await this.registry.authorizeRecipient(
      cId,
      recipientAddress,
      identityCommitment,
      wallet
    )

    return {
      capsuleId: cId as `0x${string}`,
      recipient: recipientAddress,
      identityCommitment,
      transactionHash: txHash,
      status: 'authorized',
    }
  }

  /**
   * Helper to generate an ephemeral X25519 keypair and sign a canonical release request.
   */
  async prepareReleaseRequest(params: {
    capsuleId: string
    policyHash: string
    signer?: VeilWalletAdapter
    ephemeralPrivateKey?: Uint8Array
    worldProof?: any
    organizationCredential?: any
  }) {
    const wallet = params.signer || this.defaultWallet
    if (!wallet) {
      throw new InvalidParameterError('signer', 'Wallet signer is required')
    }
    const recipient = await wallet.getAddress()
    const ephKeypair = params.ephemeralPrivateKey
      ? { priv: params.ephemeralPrivateKey, pub: genKeyPair().pub }
      : genKeyPair()

    const recipientPub = toHex(ephKeypair.pub)
    const nonce = `nonce_${crypto.randomUUID().replace(/-/g, '')}`
    const expiry = Date.now() + 5 * 60 * 1000

    const signed = await signReleaseRequestV2({
      account: {
        address: recipient,
        signMessage: (m: any) => wallet.signMessage(typeof m === 'string' ? m : m.message),
      },
      registryAddress: this.registry.address,
      capsuleId: params.capsuleId,
      policyHash: params.policyHash,
      recipientPub,
      worldProof: params.worldProof,
      orgCredential: params.organizationCredential,
      nonce,
      expiry,
    })

    return {
      ephemeralKeypair: ephKeypair,
      recipientPub,
      signedRequest: signed,
    }
  }
}
