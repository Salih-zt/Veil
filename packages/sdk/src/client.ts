// VEIL Protocol SDK — Main VeilClient Interface

import { createPublicClient, http } from 'viem'
import type {
  VeilClientConfig,
  VeilStorageAdapter,
  VeilGuardianAdapter,
  VeilRegistryAdapter,
  VeilWalletAdapter,
  VeilIdentityAdapter,
} from './types/index.js'
import { MemoryStorageAdapter } from './adapters/storage.js'
import { HttpGuardianAdapter } from './adapters/guardian.js'
import { ViemRegistryAdapter } from './adapters/registry.js'
import { DefaultIdentityAdapter } from './adapters/identity.js'
import { CapsuleManager } from './modules/capsules.js'
import { RecipientManager } from './modules/recipients.js'
import { encodeToCarrierText, decodeFromCarrierText, isCarrierText } from '../../crypto/codec/wordmap.mjs'

export class VeilClient {
  public readonly chainId: number
  public readonly registryAddress: `0x${string}`
  public readonly storage: VeilStorageAdapter
  public readonly registry: VeilRegistryAdapter
  public readonly guardians: VeilGuardianAdapter[]
  public readonly identity: VeilIdentityAdapter
  public readonly defaultWallet?: VeilWalletAdapter

  public readonly capsules: CapsuleManager
  public readonly recipients: RecipientManager

  constructor(config: VeilClientConfig) {
    this.chainId = config.chainId || 31337
    this.registryAddress = (config.registryAddress.startsWith('0x')
      ? config.registryAddress
      : `0x${config.registryAddress}`) as `0x${string}`

    this.defaultWallet = config.defaultWallet

    // 1. Storage adapter
    this.storage = config.storage || new MemoryStorageAdapter()

    // 2. Registry adapter
    if (config.registry) {
      this.registry = config.registry
    } else {
      const publicClient = config.publicClient || createPublicClient({
        transport: http(config.rpcUrl || 'http://127.0.0.1:8545'),
      })
      this.registry = new ViemRegistryAdapter({
        address: this.registryAddress,
        publicClient,
        defaultWallet: this.defaultWallet,
      })
    }

    // 3. Guardian adapters
    if (config.guardians && config.guardians.length > 0) {
      this.guardians = config.guardians
    } else if (config.guardianUrls && config.guardianUrls.length > 0) {
      this.guardians = config.guardianUrls.map(
        (url, idx) => new HttpGuardianAdapter(url, `guardian-${idx + 1}`)
      )
    } else {
      // Default local cluster ports
      this.guardians = [
        new HttpGuardianAdapter('http://localhost:8791', 'guardian-1'),
        new HttpGuardianAdapter('http://localhost:8792', 'guardian-2'),
        new HttpGuardianAdapter('http://localhost:8793', 'guardian-3'),
      ]
    }

    // 4. Identity adapter
    this.identity = config.identityAdapter || new DefaultIdentityAdapter()

    // 5. Initialize managers
    this.capsules = new CapsuleManager({
      storage: this.storage,
      registry: this.registry,
      guardians: this.guardians,
      defaultWallet: this.defaultWallet,
    })

    this.recipients = new RecipientManager({
      registry: this.registry,
      defaultWallet: this.defaultWallet,
      identityAdapter: this.identity,
    })
  }

  /** Steganographic helper: encode raw descriptor bytes to natural English text */
  public encodeToCarrier(descriptor: Uint8Array): string {
    return encodeToCarrierText(descriptor)
  }

  /** Steganographic helper: decode natural English text to descriptor bytes */
  public decodeFromCarrier(carrierText: string): Uint8Array {
    return decodeFromCarrierText(carrierText)
  }

  /** Steganographic helper: detect if text is a VEIL carrier */
  public isCarrierText(text: string): boolean {
    return isCarrierText(text)
  }
}
