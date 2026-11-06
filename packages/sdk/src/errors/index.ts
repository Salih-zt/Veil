// VEIL Protocol SDK — Structured Error Hierarchy

export abstract class VeilError extends Error {
  public abstract readonly code: string
  public readonly context?: Record<string, unknown>

  constructor(message: string, context?: Record<string, unknown>) {
    super(message)
    this.name = this.constructor.name
    this.context = context
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class CapsuleNotFoundError extends VeilError {
  public readonly code = 'CAPSULE_NOT_FOUND'
  constructor(capsuleId: string, context?: Record<string, unknown>) {
    super(`Capsule with ID "${capsuleId}" was not found`, { capsuleId, ...context })
  }
}

export class CapsuleLockedError extends VeilError {
  public readonly code = 'CAPSULE_LOCKED'
  constructor(message: string, context?: Record<string, unknown>) {
    super(message, context)
  }
}

export class CapsuleExpiredError extends VeilError {
  public readonly code = 'CAPSULE_EXPIRED'
  constructor(expiryTimestamp: number, context?: Record<string, unknown>) {
    super(`Capsule expired at timestamp ${expiryTimestamp} (${new Date(expiryTimestamp * 1000).toISOString()})`, {
      expiryTimestamp,
      ...context,
    })
  }
}

export class CapsuleRevokedError extends VeilError {
  public readonly code = 'CAPSULE_REVOKED'
  constructor(capsuleId: string, context?: Record<string, unknown>) {
    super(`Capsule with ID "${capsuleId}" has been revoked by its creator`, { capsuleId, ...context })
  }
}

export class InsufficientApprovalsError extends VeilError {
  public readonly code = 'INSUFFICIENT_APPROVALS'
  constructor(current: number, required: number, context?: Record<string, unknown>) {
    super(`Capsule has ${current} reviewer approvals, but ${required} are required for release`, {
      current,
      required,
      ...context,
    })
  }
}

export class RecipientNotAuthorizedError extends VeilError {
  public readonly code = 'RECIPIENT_NOT_AUTHORIZED'
  constructor(recipient: string, capsuleId: string, context?: Record<string, unknown>) {
    super(`Recipient address "${recipient}" is not authorized for capsule "${capsuleId}"`, {
      recipient,
      capsuleId,
      ...context,
    })
  }
}

export class IdentityVerificationError extends VeilError {
  public readonly code = 'IDENTITY_VERIFICATION_FAILED'
  constructor(reason: string, context?: Record<string, unknown>) {
    super(`Identity proof verification failed: ${reason}`, { reason, ...context })
  }
}

export class GuardianUnavailableError extends VeilError {
  public readonly code = 'GUARDIAN_UNAVAILABLE'
  constructor(guardianIdOrUrl: string, reason: string, context?: Record<string, unknown>) {
    super(`Guardian "${guardianIdOrUrl}" is unavailable or unreachable: ${reason}`, {
      guardianIdOrUrl,
      reason,
      ...context,
    })
  }
}

export class InsufficientGuardianSharesError extends VeilError {
  public readonly code = 'INSUFFICIENT_GUARDIAN_SHARES'
  constructor(collected: number, required: number, context?: Record<string, unknown>) {
    super(`Collected ${collected} valid guardian shares, but threshold requires ${required}`, {
      collected,
      required,
      ...context,
    })
  }
}

export class InvalidGuardianSignatureError extends VeilError {
  public readonly code = 'INVALID_GUARDIAN_SIGNATURE'
  constructor(guardianId: string, context?: Record<string, unknown>) {
    super(`Guardian "${guardianId}" returned an invalid or forged response signature`, {
      guardianId,
      ...context,
    })
  }
}

export class CiphertextIntegrityError extends VeilError {
  public readonly code = 'CIPHERTEXT_INTEGRITY_VIOLATION'
  constructor(expectedHash: string, actualHash: string, context?: Record<string, unknown>) {
    super(`Ciphertext integrity check failed: expected hash ${expectedHash}, computed ${actualHash}`, {
      expectedHash,
      actualHash,
      ...context,
    })
  }
}

export class ShareReconstructionError extends VeilError {
  public readonly code = 'SHARE_RECONSTRUCTION_FAILED'
  constructor(reason: string, context?: Record<string, unknown>) {
    super(`Failed to reconstruct secret encryption key from threshold shares: ${reason}`, {
      reason,
      ...context,
    })
  }
}

export class StorageError extends VeilError {
  public readonly code = 'STORAGE_ERROR'
  constructor(operation: 'store' | 'retrieve', reason: string, context?: Record<string, unknown>) {
    super(`Storage operation "${operation}" failed: ${reason}`, { operation, reason, ...context })
  }
}

export class TransactionError extends VeilError {
  public readonly code = 'TRANSACTION_ERROR'
  constructor(action: string, reason: string, context?: Record<string, unknown>) {
    super(`Onchain transaction for "${action}" failed: ${reason}`, { action, reason, ...context })
  }
}

export class InvalidParameterError extends VeilError {
  public readonly code = 'INVALID_PARAMETER'
  constructor(paramName: string, reason: string, context?: Record<string, unknown>) {
    super(`Invalid parameter "${paramName}": ${reason}`, { paramName, reason, ...context })
  }
}
