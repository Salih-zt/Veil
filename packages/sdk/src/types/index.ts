// VEIL Protocol SDK — TypeScript Interfaces and Types

export interface CapsulePolicyConfig {
  /** Unlock time as ISO string or Unix timestamp in seconds */
  unlockAt: string | number
  /** Optional expiry time as ISO string or Unix timestamp in seconds */
  expiresAt?: string | number
  /** Quorum threshold (k) of reviewers and guardians required */
  threshold: number
  /** List of reviewer EVM addresses */
  reviewers: `0x${string}`[] | string[]
  /** Whether World ID 4.0 proof of humanity is required */
  requireWorldId?: boolean
  /** Required enterprise organization identifier (e.g. 'paycore') */
  requiredOrg?: string
  /** Required organizational role (e.g. 'Security Lead') */
  requiredRole?: string
}

export interface CapsuleRecipientConfig {
  address: `0x${string}` | string
  encryptionPublicKey?: string
}

export interface CapsuleCreateInput {
  title?: string
  description?: string
  /** Confidential plaintext secret to encapsulate */
  content: Uint8Array | string
  /** Release policy constraints */
  policy: CapsulePolicyConfig
  /** Authorized recipient addresses */
  recipients?: (`0x${string}` | string | CapsuleRecipientConfig)[]
  /** Specific guardians to use (defaults to client configured guardians) */
  guardians?: string[] | VeilGuardianAdapter[]
}

export interface CapsuleDescriptor {
  version: number
  capsuleId: `0x${string}`
  policyHash: `0x${string}`
  ciphertextHash: `0x${string}`
  threshold: number
  totalShares: number
  storageType: number
  ciphertext?: Uint8Array
  carrierText?: string
  rawBytes: Uint8Array
  armored: string
}

export interface CapsuleCreateResult {
  capsuleId: `0x${string}`
  policyHash: `0x${string}`
  ciphertextHash: `0x${string}`
  descriptor: CapsuleDescriptor
  storageReference: string
  transactionHash?: `0x${string}`
  carrierText: string
  status: 'created'
}

export interface CapsuleDetails {
  capsuleId: `0x${string}`
  creator: `0x${string}`
  policyHash: `0x${string}`
  ciphertextHash: `0x${string}`
  unlockTimestamp: number
  unlockDate: string
  expiryTimestamp: number
  expiryDate: string
  threshold: number
  approvalCount: number
  reviewers: `0x${string}`[]
  revoked: boolean
  exists: boolean
  isReleaseReady: boolean
  isRecipientAuthorized?: boolean
  requirements: {
    timeSatisfied: boolean
    quorumSatisfied: boolean
    requireWorldId: boolean
    requiredOrg?: string
    requiredRole?: string
  }
}

export interface CapsuleApproveInput {
  capsuleId: string
  signer?: VeilWalletAdapter
}

export interface RecipientAuthorizeInput {
  capsuleId: string
  signer?: VeilWalletAdapter
  identityProof?: any
  organizationCredential?: any
}

export interface RecipientAuthorizeResult {
  capsuleId: `0x${string}`
  recipient: `0x${string}`
  identityCommitment: `0x${string}`
  transactionHash?: `0x${string}`
  status: 'authorized'
}

export interface CapsuleDecryptInput {
  capsuleId?: string
  descriptor?: Uint8Array | string
  carrierText?: string
  recipient?: VeilWalletAdapter
  ephemeralPrivateKey?: Uint8Array | string
  worldProof?: any
  organizationCredential?: any
  nowSec?: number
}

export interface CapsuleDecryptResult {
  capsuleId: `0x${string}`
  plaintext: Uint8Array
  text: string
  receipt: DisclosureReceipt
}

export interface DisclosureReceipt {
  receiptId: string
  issuedAt: string
  timestamp: number
  capsule: {
    capsuleId: string
    policyHash: string
    ciphertextHash: string
    recipientAddress: string
  }
  onchainVerification: {
    contractVerified: boolean
    contractAddress: string | null
    blockNumber: number | string
    txHash: string | null
    unlockTimestamp: number
    expiryTimestamp: number
    thresholdRequired: number
    approvalsRecorded: number
    quorumSatisfied: boolean
    revoked: boolean
  }
  identityVerification: {
    worldId: {
      verified: boolean
      nullifier?: string
      action?: string
      protocolVersion?: string
    }
    organizationalRole: {
      verified: boolean
      orgId?: string
      role?: string
      authorityAddress?: string
    }
  }
  guardianRelease: {
    thresholdMet: boolean
    sharesCollected: number
    participatingGuardians: Array<{
      guardianId: string
      guardianAddress: string
      shareIndex: number
      timestamp: number
      hasSignature: boolean
      signaturePreview: string | null
    }>
  }
  clientExecution: {
    decryptionSuccess: boolean
    decryptedAt: string | null
    clientKeyProtection: string
  }
  auditNotice: string
}

// -------------------------------------------------------------
// Adapter Interfaces
// -------------------------------------------------------------

export interface VeilStorageAdapter {
  upload(params: { capsuleId: string; ciphertext: Uint8Array; ciphertextHash: string }): Promise<string>
  download(params: { storageReference: string; expectedCiphertextHash: string }): Promise<Uint8Array>
  has?(storageReference: string): Promise<boolean>
}

export interface GuardianDepositInput {
  capsuleId: string
  shareIndex: number
  sealedBox: Uint8Array
  policyHash: string
  ciphertextHash: string
  requirements?: {
    requireWorldId?: boolean
    requiredOrg?: string
    requiredRole?: string
  }
}

export interface GuardianDepositResult {
  ok: boolean
  shareIndex: number
  guardianId: string
}

export interface GuardianReleaseInput {
  capsuleId: string
  recipient: string
  recipientPub: string
  nonce: string
  expiry: number
  signature: string
  chainId?: number
  registryAddress?: string
  policyHash?: string
  worldProof?: any
  orgCredential?: any
}

export interface GuardianReleaseResult {
  ok: boolean
  guardianId: string
  guardianAddress: string
  capsuleId: string
  shareIndex: number
  sealedShare: Uint8Array
  timestamp: number
  signature: string
  error?: string
}

export interface VeilGuardianAdapter {
  readonly guardianId: string
  getPublicKey(): Promise<string>
  depositShare(input: GuardianDepositInput): Promise<GuardianDepositResult>
  requestShare(input: GuardianReleaseInput): Promise<GuardianReleaseResult>
}

export interface VeilWalletAdapter {
  getAddress(): Promise<`0x${string}`>
  signMessage(message: string): Promise<`0x${string}`>
  sendTransaction?(tx: { to: `0x${string}`; data: `0x${string}`; value?: bigint }): Promise<`0x${string}`>
}

export interface VeilRegistryAdapter {
  readonly address: `0x${string}`
  getCapsule(capsuleId: string): Promise<any>
  getReviewers(capsuleId: string): Promise<`0x${string}`[]>
  isReleaseReady(capsuleId: string): Promise<boolean>
  isReleaseReadyForRecipient(capsuleId: string, recipient: string): Promise<boolean>
  recipientIdentityCommitment(capsuleId: string, recipient: string): Promise<`0x${string}`>
  createCapsule(params: {
    capsuleId: string
    ciphertextHash: string
    policyHash: string
    unlockTimestamp: number
    expiryTimestamp: number
    threshold: number
    reviewers: string[]
  }, signer?: VeilWalletAdapter): Promise<`0x${string}`>
  approveRelease(capsuleId: string, signer?: VeilWalletAdapter): Promise<`0x${string}`>
  authorizeRecipient(capsuleId: string, recipient: string, commitment: string, signer?: VeilWalletAdapter): Promise<`0x${string}`>
  revokeCapsule(capsuleId: string, signer?: VeilWalletAdapter): Promise<`0x${string}`>
}

export interface VeilIdentityAdapter {
  verifyWorldProof?(proof: any, context: { capsuleId: string; recipient: string; recipientPub: string }): Promise<{ ok: boolean; nullifier?: string; reason?: string }>
  verifyOrgCredential?(credential: any, context: { capsuleId: string; recipient: string }): Promise<{ ok: boolean; orgId?: string; role?: string; reason?: string }>
}

export interface VeilClientConfig {
  chainId?: number
  rpcUrl?: string
  publicClient?: any
  registryAddress: `0x${string}` | string
  registry?: VeilRegistryAdapter
  guardianUrls?: string[]
  guardians?: VeilGuardianAdapter[]
  storage?: VeilStorageAdapter
  defaultWallet?: VeilWalletAdapter
  identityAdapter?: VeilIdentityAdapter
}
