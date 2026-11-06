// VEIL Protocol SDK — Guardian Network Adapters

import type {
  VeilGuardianAdapter,
  GuardianDepositInput,
  GuardianDepositResult,
  GuardianReleaseInput,
  GuardianReleaseResult,
} from '../types/index.js'
import { GuardianUnavailableError, InvalidGuardianSignatureError } from '../errors/index.js'

function toHex(bytes: Uint8Array): string {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

function fromHex(hex: string): Uint8Array {
  const clean = hex.startsWith('0x') ? hex.slice(2) : hex
  const out = new Uint8Array(clean.length / 2)
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.slice(i * 2, i * 2 + 2), 16)
  }
  return out
}

/**
 * Standard HTTP Guardian adapter connecting to remote or local guardian microservices.
 */
export class HttpGuardianAdapter implements VeilGuardianAdapter {
  public readonly guardianId: string
  private readonly baseUrl: string
  private cachedPub: string | null = null

  constructor(url: string, guardianId?: string) {
    this.baseUrl = url.replace(/\/$/, '')
    this.guardianId = guardianId || `guardian-http-${this.baseUrl.split(':').pop()}`
  }

  async getPublicKey(): Promise<string> {
    if (this.cachedPub) return this.cachedPub
    try {
      const res = await fetch(`${this.baseUrl}/health`, {
        method: 'GET',
        headers: { Accept: 'application/json' },
      })
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}: ${res.statusText}`)
      }
      const data = await res.json() as any
      if (!data || !data.pubKey) {
        throw new Error('Malformed health response: missing pubKey')
      }
      this.cachedPub = data.pubKey
      return data.pubKey
    } catch (err: any) {
      throw new GuardianUnavailableError(this.baseUrl, err.message)
    }
  }

  async depositShare(input: GuardianDepositInput): Promise<GuardianDepositResult> {
    try {
      const res = await fetch(`${this.baseUrl}/deposit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capsuleId: input.capsuleId,
          shareIndex: input.shareIndex,
          sealedBox: toHex(input.sealedBox),
          policyHash: input.policyHash,
          ciphertextHash: input.ciphertextHash,
          requirements: input.requirements,
        }),
      })

      const data = await res.json() as any
      if (!res.ok || !data.ok) {
        throw new Error(data?.error || `HTTP ${res.status}`)
      }

      return {
        ok: true,
        shareIndex: data.shareIndex,
        guardianId: data.guardianId || this.guardianId,
      }
    } catch (err: any) {
      throw new GuardianUnavailableError(this.baseUrl, `Deposit failed: ${err.message}`)
    }
  }

  async requestShare(input: GuardianReleaseInput): Promise<GuardianReleaseResult> {
    try {
      const res = await fetch(`${this.baseUrl}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(input),
      })

      const data = await res.json() as any
      if (!res.ok || !data.ok) {
        return {
          ok: false,
          guardianId: this.guardianId,
          guardianAddress: data?.guardianAddress || '',
          capsuleId: input.capsuleId,
          shareIndex: -1,
          sealedShare: new Uint8Array(0),
          timestamp: 0,
          signature: '',
          error: data?.error || `HTTP ${res.status}`,
        }
      }

      const sealedShare = typeof data.sealedShare === 'string'
        ? fromHex(data.sealedShare)
        : new Uint8Array(data.sealedShare)

      return {
        ok: true,
        guardianId: data.guardianId || this.guardianId,
        guardianAddress: data.guardianAddress,
        capsuleId: data.capsuleId,
        shareIndex: data.shareIndex,
        sealedShare,
        timestamp: data.timestamp,
        signature: data.signature,
      }
    } catch (err: any) {
      throw new GuardianUnavailableError(this.baseUrl, `Release request failed: ${err.message}`)
    }
  }
}

/**
 * Direct in-process guardian adapter for local testing, offline simulation, and benchmarking.
 */
export class DirectGuardianAdapter implements VeilGuardianAdapter {
  public readonly guardianId: string
  private readonly core: any

  constructor(coreInstance: any) {
    this.core = coreInstance
    this.guardianId = coreInstance.guardianId || 'guardian-direct'
  }

  async getPublicKey(): Promise<string> {
    const health = this.core.health()
    return health.pubKey
  }

  async depositShare(input: GuardianDepositInput): Promise<GuardianDepositResult> {
    const res = await this.core.deposit({
      capsuleId: input.capsuleId,
      shareIndex: input.shareIndex,
      sealedBox: input.sealedBox,
      policyHash: input.policyHash,
      ciphertextHash: input.ciphertextHash,
      requirements: input.requirements,
    })
    return {
      ok: res.ok,
      shareIndex: res.shareIndex,
      guardianId: res.guardianId || this.guardianId,
    }
  }

  async requestShare(input: GuardianReleaseInput): Promise<GuardianReleaseResult> {
    try {
      const res = await this.core.release(input)
      return {
        ok: res.ok,
        guardianId: res.guardianId || this.guardianId,
        guardianAddress: res.guardianAddress,
        capsuleId: res.capsuleId,
        shareIndex: res.shareIndex,
        sealedShare: res.sealedShare,
        timestamp: res.timestamp,
        signature: res.signature,
      }
    } catch (err: any) {
      return {
        ok: false,
        guardianId: this.guardianId,
        guardianAddress: '',
        capsuleId: input.capsuleId,
        shareIndex: -1,
        sealedShare: new Uint8Array(0),
        timestamp: 0,
        signature: '',
        error: err.message,
      }
    }
  }
}
