// VEIL Protocol SDK — Wallet & Signer Adapters

import type { VeilWalletAdapter } from '../types/index.js'
import { InvalidParameterError } from '../errors/index.js'

/**
 * Adapter for Viem PrivateKeyAccount or HDAccount.
 */
export class ViemAccountWalletAdapter implements VeilWalletAdapter {
  private readonly account: any

  constructor(account: any) {
    if (!account || !account.address || !account.signMessage) {
      throw new InvalidParameterError('account', 'Account must provide an address and signMessage implementation')
    }
    this.account = account
  }

  async getAddress(): Promise<`0x${string}`> {
    return this.account.address as `0x${string}`
  }

  async signMessage(message: string): Promise<`0x${string}`> {
    return this.account.signMessage({ message })
  }
}

/**
 * Generic wallet adapter for custom wallets or EIP-1193 browser providers.
 */
export class GenericWalletAdapter implements VeilWalletAdapter {
  private readonly addressGetter: () => Promise<string>
  private readonly messageSigner: (message: string) => Promise<string>

  constructor(params: {
    getAddress: () => Promise<string>
    signMessage: (message: string) => Promise<string>
  }) {
    if (!params.getAddress || !params.signMessage) {
      throw new InvalidParameterError('params', 'getAddress and signMessage functions are required')
    }
    this.addressGetter = params.getAddress
    this.messageSigner = params.signMessage
  }

  async getAddress(): Promise<`0x${string}`> {
    const addr = await this.addressGetter()
    return (addr.startsWith('0x') ? addr : `0x${addr}`) as `0x${string}`
  }

  async signMessage(message: string): Promise<`0x${string}`> {
    const sig = await this.messageSigner(message)
    return (sig.startsWith('0x') ? sig : `0x${sig}`) as `0x${string}`
  }
}
