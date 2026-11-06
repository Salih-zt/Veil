// VEIL Protocol — Persistent Relational Store (ACID SQLite)
// Manages users, sessions, rooms, invitations, capsules, requests, and votes.

import { DatabaseSync } from 'node:sqlite'
import { mkdirSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { tmpdir } from 'node:os'
import { sha256 } from '@noble/hashes/sha2.js'

const HERE = dirname(fileURLToPath(import.meta.url))
const DATA_DIR = process.env.VERCEL ? tmpdir() : join(HERE, 'data')
try {
  mkdirSync(DATA_DIR, { recursive: true })
} catch {
  // Read-only filesystem fallback
}

function toHex(bytes) {
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

export function initDatabase(dbPath = (process.env.DATABASE_PATH || join(DATA_DIR, 'veil.sqlite'))) {
  const db = new DatabaseSync(dbPath)

  // Enable WAL mode for high concurrency
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')

  // Create tables
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE,
      email_verified INTEGER DEFAULT 0,
      email_verified_at TEXT,
      wallet_address TEXT UNIQUE NOT NULL,
      ens_name TEXT,
      ens_verified INTEGER DEFAULT 0,
      ens_verified_at TEXT,
      world_id_verified INTEGER DEFAULT 0,
      world_id_nullifier TEXT UNIQUE,
      world_id_verified_at TEXT,
      created_at TEXT NOT NULL,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS email_tokens (
      token_hash TEXT PRIMARY KEY,
      email TEXT NOT NULL,
      otp TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      used INTEGER DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS auth_sessions (
      token TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS auth_nonces (
      address TEXT PRIMARY KEY,
      nonce TEXT NOT NULL,
      message TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS rooms (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      description TEXT,
      organization TEXT,
      creator_wallet TEXT NOT NULL,
      visibility TEXT DEFAULT 'private',
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS room_members (
      room_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      role TEXT NOT NULL,
      joined_at TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      PRIMARY KEY (room_id, wallet_address)
    );

    CREATE TABLE IF NOT EXISTS room_invitations (
      id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      email TEXT,
      token_hash TEXT UNIQUE NOT NULL,
      role TEXT NOT NULL,
      inviter_wallet TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS capsules (
      capsule_id TEXT PRIMARY KEY,
      room_id TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT,
      classification TEXT DEFAULT 'CONFIDENTIAL',
      creator_wallet TEXT NOT NULL,
      access_mode TEXT DEFAULT 'named',
      policy_hash TEXT NOT NULL,
      ciphertext_hash TEXT NOT NULL,
      storage_reference TEXT NOT NULL,
      carrier_text TEXT NOT NULL,
      unlock_timestamp INTEGER NOT NULL,
      expiry_timestamp INTEGER NOT NULL,
      approval_threshold INTEGER NOT NULL,
      guardian_threshold INTEGER NOT NULL,
      require_world_id INTEGER DEFAULT 1,
      require_ens INTEGER DEFAULT 1,
      status TEXT DEFAULT 'active',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS capsule_recipients (
      capsule_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      PRIMARY KEY (capsule_id, wallet_address)
    );

    CREATE TABLE IF NOT EXISTS capsule_approvers (
      capsule_id TEXT NOT NULL,
      wallet_address TEXT NOT NULL,
      PRIMARY KEY (capsule_id, wallet_address)
    );

    CREATE TABLE IF NOT EXISTS release_requests (
      request_id TEXT PRIMARY KEY,
      capsule_id TEXT NOT NULL,
      requester_wallet TEXT NOT NULL,
      requester_ens TEXT,
      requester_ephemeral_pubkey TEXT NOT NULL,
      nonce TEXT NOT NULL,
      signature TEXT NOT NULL,
      world_id_nullifier TEXT,
      status TEXT DEFAULT 'pending',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS release_votes (
      request_id TEXT NOT NULL,
      capsule_id TEXT NOT NULL,
      voter_wallet TEXT NOT NULL,
      vote TEXT NOT NULL,
      signature TEXT,
      tx_hash TEXT,
      voted_at TEXT NOT NULL,
      PRIMARY KEY (request_id, voter_wallet)
    );

    CREATE TABLE IF NOT EXISTS disclosure_receipts (
      receipt_id TEXT PRIMARY KEY,
      capsule_id TEXT NOT NULL,
      recipient_wallet TEXT NOT NULL,
      released_at TEXT NOT NULL,
      details_json TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      recipient_wallet TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT NOT NULL,
      link TEXT,
      read INTEGER DEFAULT 0,
      created_at TEXT NOT NULL
    );
  `)

  return {
    db,

    // -------------------------------------------------------------------------
    // USERS
    // -------------------------------------------------------------------------
    createUser({ id, email = null, walletAddress, ensName = null }) {
      const now = new Date().toISOString()
      const stmt = db.prepare(`
        INSERT INTO users (id, email, wallet_address, ens_name, created_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      stmt.run(id, email?.toLowerCase() || null, walletAddress.toLowerCase(), ensName || null, now)
      return this.getUserByWallet(walletAddress)
    },

    getUserByWallet(walletAddress) {
      if (!walletAddress) return null
      const stmt = db.prepare('SELECT * FROM users WHERE wallet_address = ?')
      return stmt.get(walletAddress.toLowerCase()) || null
    },

    getUserByEmail(email) {
      if (!email) return null
      const stmt = db.prepare('SELECT * FROM users WHERE email = ?')
      return stmt.get(email.toLowerCase()) || null
    },

    getUserById(id) {
      const stmt = db.prepare('SELECT * FROM users WHERE id = ?')
      return stmt.get(id) || null
    },

    updateUserEmail(walletAddress, email) {
      const now = new Date().toISOString()
      const stmt = db.prepare(`
        UPDATE users 
        SET email = ?, email_verified = 1, email_verified_at = ?
        WHERE wallet_address = ?
      `)
      stmt.run(email.toLowerCase(), now, walletAddress.toLowerCase())
      return this.getUserByWallet(walletAddress)
    },

    updateUserEns(walletAddress, ensName, verified = true) {
      const now = new Date().toISOString()
      const stmt = db.prepare(`
        UPDATE users
        SET ens_name = ?, ens_verified = ?, ens_verified_at = ?
        WHERE wallet_address = ?
      `)
      stmt.run(ensName, verified ? 1 : 0, verified ? now : null, walletAddress.toLowerCase())
      return this.getUserByWallet(walletAddress)
    },

    updateUserWorldId(walletAddress, nullifier) {
      const now = new Date().toISOString()
      const stmt = db.prepare(`
        UPDATE users
        SET world_id_verified = 1, world_id_nullifier = ?, world_id_verified_at = ?
        WHERE wallet_address = ?
      `)
      stmt.run(nullifier, now, walletAddress.toLowerCase())
      return this.getUserByWallet(walletAddress)
    },

    // -------------------------------------------------------------------------
    // AUTH NONCES & SESSIONS
    // -------------------------------------------------------------------------
    saveAuthNonce(address, nonce, message, ttlSec = 300) {
      const expiresAt = new Date(Date.now() + ttlSec * 1000).toISOString()
      const stmt = db.prepare(`
        INSERT INTO auth_nonces (address, nonce, message, expires_at)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(address) DO UPDATE SET
          nonce = excluded.nonce,
          message = excluded.message,
          expires_at = excluded.expires_at
      `)
      stmt.run(address.toLowerCase(), nonce, message, expiresAt)
    },

    getAuthNonce(address) {
      const stmt = db.prepare('SELECT * FROM auth_nonces WHERE address = ?')
      const row = stmt.get(address.toLowerCase())
      if (!row) return null
      if (new Date(row.expires_at) < new Date()) {
        this.deleteAuthNonce(address)
        return null
      }
      return row
    },

    deleteAuthNonce(address) {
      const stmt = db.prepare('DELETE FROM auth_nonces WHERE address = ?')
      stmt.run(address.toLowerCase())
    },

    createSession(token, userId, walletAddress, ttlHours = 24) {
      const now = new Date().toISOString()
      const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString()
      const stmt = db.prepare(`
        INSERT INTO auth_sessions (token, user_id, wallet_address, created_at, expires_at)
        VALUES (?, ?, ?, ?, ?)
      `)
      stmt.run(token, userId, walletAddress.toLowerCase(), now, expiresAt)
    },

    getSession(token) {
      const stmt = db.prepare('SELECT * FROM auth_sessions WHERE token = ?')
      const row = stmt.get(token)
      if (!row) return null
      if (new Date(row.expires_at) < new Date()) {
        this.deleteSession(token)
        return null
      }
      return row
    },

    deleteSession(token) {
      const stmt = db.prepare('DELETE FROM auth_sessions WHERE token = ?')
      stmt.run(token)
    },

    // -------------------------------------------------------------------------
    // EMAIL REGISTRATION & OTP
    // -------------------------------------------------------------------------
    createEmailOtp(email, otp, ttlMin = 15) {
      const tokenHash = toHex(sha256(new TextEncoder().encode(`${email}:${otp}:${Date.now()}`)))
      const expiresAt = new Date(Date.now() + ttlMin * 60 * 1000).toISOString()
      const stmt = db.prepare(`
        INSERT INTO email_tokens (token_hash, email, otp, expires_at, used)
        VALUES (?, ?, ?, ?, 0)
      `)
      stmt.run(tokenHash, email.toLowerCase(), otp, expiresAt)
      return { tokenHash, email: email.toLowerCase(), otp, expiresAt }
    },

    verifyEmailOtp(email, otp) {
      const stmt = db.prepare(`
        SELECT * FROM email_tokens 
        WHERE email = ? AND otp = ? AND used = 0
        ORDER BY expires_at DESC LIMIT 1
      `)
      const row = stmt.get(email.toLowerCase(), otp)
      if (!row) return false
      if (new Date(row.expires_at) < new Date()) return false
      db.prepare('UPDATE email_tokens SET used = 1 WHERE token_hash = ?').run(row.token_hash)
      return true
    },

    // -------------------------------------------------------------------------
    // ROOMS & MEMBERSHIP
    // -------------------------------------------------------------------------
    createRoom({ id, name, description = '', organization = '', creatorWallet, visibility = 'private' }) {
      const now = new Date().toISOString()
      const stmt = db.prepare(`
        INSERT INTO rooms (id, name, description, organization, creator_wallet, visibility, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(id, name, description, organization, creatorWallet.toLowerCase(), visibility, now)

      // Creator is automatically owner
      this.addRoomMember(id, creatorWallet, 'owner')
      return this.getRoom(id)
    },

    getRoom(id) {
      const stmt = db.prepare('SELECT * FROM rooms WHERE id = ?')
      const room = stmt.get(id)
      if (!room) return null
      room.members = this.getRoomMembers(id)
      return room
    },

    listUserRooms(walletAddress) {
      const stmt = db.prepare(`
        SELECT r.*, rm.role as user_role
        FROM rooms r
        JOIN room_members rm ON r.id = rm.room_id
        WHERE rm.wallet_address = ? AND rm.status = 'active'
        ORDER BY r.created_at DESC
      `)
      return stmt.all(walletAddress.toLowerCase())
    },

    addRoomMember(roomId, walletAddress, role = 'approver') {
      const now = new Date().toISOString()
      const stmt = db.prepare(`
        INSERT INTO room_members (room_id, wallet_address, role, joined_at, status)
        VALUES (?, ?, ?, ?, 'active')
        ON CONFLICT(room_id, wallet_address) DO UPDATE SET
          role = excluded.role,
          status = 'active'
      `)
      stmt.run(roomId, walletAddress.toLowerCase(), role, now)
    },

    getRoomMembers(roomId) {
      const stmt = db.prepare(`
        SELECT rm.*, u.ens_name, u.email, u.world_id_verified
        FROM room_members rm
        LEFT JOIN users u ON rm.wallet_address = u.wallet_address
        WHERE rm.room_id = ? AND rm.status = 'active'
      `)
      return stmt.all(roomId)
    },

    isMember(roomId, walletAddress) {
      const stmt = db.prepare("SELECT role FROM room_members WHERE room_id = ? AND wallet_address = ? AND status = 'active'")
      const row = stmt.get(roomId, walletAddress.toLowerCase())
      return row ? row.role : null
    },

    // -------------------------------------------------------------------------
    // ROOM INVITATIONS
    // -------------------------------------------------------------------------
    createInvitation({ id, roomId, email = null, rawToken, role = 'approver', inviterWallet, ttlHours = 72 }) {
      const tokenHash = toHex(sha256(new TextEncoder().encode(rawToken)))
      const now = new Date().toISOString()
      const expiresAt = new Date(Date.now() + ttlHours * 3600 * 1000).toISOString()
      const stmt = db.prepare(`
        INSERT INTO room_invitations (id, room_id, email, token_hash, role, inviter_wallet, expires_at, created_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `)
      stmt.run(id, roomId, email?.toLowerCase() || null, tokenHash, role, inviterWallet.toLowerCase(), expiresAt, now)
      return { id, roomId, email, rawToken, role, expiresAt }
    },

    getInvitationByToken(rawToken) {
      const tokenHash = toHex(sha256(new TextEncoder().encode(rawToken)))
      const stmt = db.prepare(`
        SELECT ri.*, r.name as room_name, r.description as room_description
        FROM room_invitations ri
        JOIN rooms r ON ri.room_id = r.id
        WHERE ri.token_hash = ?
      `)
      const row = stmt.get(tokenHash)
      if (!row) return null
      if (new Date(row.expires_at) < new Date() || row.status !== 'pending') {
        return { ...row, expired: true }
      }
      return row
    },

    acceptInvitation(rawToken, walletAddress) {
      const inv = this.getInvitationByToken(rawToken)
      if (!inv || inv.expired || inv.status !== 'pending') {
        throw new Error('Invitation is invalid, expired, or already used')
      }
      db.prepare("UPDATE room_invitations SET status = 'accepted' WHERE token_hash = ?").run(inv.token_hash)
      this.addRoomMember(inv.room_id, walletAddress, inv.role)
      return inv
    },

    listRoomInvitations(roomId) {
      const stmt = db.prepare('SELECT * FROM room_invitations WHERE room_id = ? ORDER BY created_at DESC')
      return stmt.all(roomId)
    },

    // -------------------------------------------------------------------------
    // CAPSULES
    // -------------------------------------------------------------------------
    createCapsuleRecord(capsuleData) {
      const {
        capsuleId,
        roomId,
        title,
        description = '',
        classification = 'CONFIDENTIAL',
        creatorWallet,
        accessMode = 'named',
        policyHash,
        ciphertextHash,
        storageReference,
        carrierText,
        unlockTimestamp,
        expiryTimestamp,
        approvalThreshold,
        guardianThreshold,
        requireWorldId = 1,
        requireEns = 1,
        recipients = [],
        approvers = [],
      } = capsuleData

      const now = new Date().toISOString()
      const stmt = db.prepare(`
        INSERT INTO capsules (
          capsule_id, room_id, title, description, classification, creator_wallet,
          access_mode, policy_hash, ciphertext_hash, storage_reference, carrier_text,
          unlock_timestamp, expiry_timestamp, approval_threshold, guardian_threshold,
          require_world_id, require_ens, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', ?)
      `)
      stmt.run(
        capsuleId, roomId, title, description, classification, creatorWallet.toLowerCase(),
        accessMode, policyHash, ciphertextHash, storageReference, carrierText,
        unlockTimestamp, expiryTimestamp, approvalThreshold, guardianThreshold,
        requireWorldId ? 1 : 0, requireEns ? 1 : 0, now
      )

      // Insert recipients
      const recStmt = db.prepare('INSERT OR IGNORE INTO capsule_recipients (capsule_id, wallet_address) VALUES (?, ?)')
      for (const r of recipients) {
        recStmt.run(capsuleId, r.toLowerCase())
      }

      // Insert approvers
      const appStmt = db.prepare('INSERT OR IGNORE INTO capsule_approvers (capsule_id, wallet_address) VALUES (?, ?)')
      for (const a of approvers) {
        appStmt.run(capsuleId, a.toLowerCase())
      }

      return this.getCapsuleRecord(capsuleId)
    },

    getCapsuleRecord(capsuleId) {
      const stmt = db.prepare('SELECT * FROM capsules WHERE capsule_id = ?')
      const row = stmt.get(capsuleId)
      if (!row) return null

      const recStmt = db.prepare('SELECT wallet_address FROM capsule_recipients WHERE capsule_id = ?')
      row.recipients = recStmt.all(capsuleId).map(r => r.wallet_address)

      const appStmt = db.prepare('SELECT wallet_address FROM capsule_approvers WHERE capsule_id = ?')
      row.approvers = appStmt.all(capsuleId).map(a => a.wallet_address)

      return row
    },

    listRoomCapsules(roomId) {
      const stmt = db.prepare('SELECT * FROM capsules WHERE room_id = ? ORDER BY created_at DESC')
      const rows = stmt.all(roomId)
      return rows.map(r => this.getCapsuleRecord(r.capsule_id))
    },

    // -------------------------------------------------------------------------
    // RELEASE REQUESTS & APPROVAL VOTES
    // -------------------------------------------------------------------------
    createReleaseRequest({ requestId, capsuleId, requesterWallet, requesterEns = null, requesterEphemeralPubkey, nonce, signature, worldIdNullifier = null }) {
      const now = new Date().toISOString()
      const stmt = db.prepare(`
        INSERT INTO release_requests (
          request_id, capsule_id, requester_wallet, requester_ens, requester_ephemeral_pubkey,
          nonce, signature, world_id_nullifier, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)
      `)
      stmt.run(requestId, capsuleId, requesterWallet.toLowerCase(), requesterEns, requesterEphemeralPubkey, nonce, signature, worldIdNullifier, now)
      return this.getReleaseRequest(requestId)
    },

    getReleaseRequest(requestId) {
      const stmt = db.prepare('SELECT * FROM release_requests WHERE request_id = ?')
      const req = stmt.get(requestId)
      if (!req) return null
      req.votes = this.getRequestVotes(requestId)
      return req
    },

    getLatestRequestForCapsule(capsuleId) {
      const stmt = db.prepare('SELECT * FROM release_requests WHERE capsule_id = ? ORDER BY created_at DESC LIMIT 1')
      const req = stmt.get(capsuleId)
      if (!req) return null
      req.votes = this.getRequestVotes(req.request_id)
      return req
    },

    recordVote({ requestId, capsuleId, voterWallet, vote = 'approve', signature = null, txHash = null }) {
      const now = new Date().toISOString()
      const stmt = db.prepare(`
        INSERT INTO release_votes (request_id, capsule_id, voter_wallet, vote, signature, tx_hash, voted_at)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(request_id, voter_wallet) DO UPDATE SET
          vote = excluded.vote,
          signature = excluded.signature,
          tx_hash = excluded.tx_hash,
          voted_at = excluded.voted_at
      `)
      stmt.run(requestId, capsuleId, voterWallet.toLowerCase(), vote, signature, txHash, now)
      return this.getRequestVotes(requestId)
    },

    getRequestVotes(requestId) {
      const stmt = db.prepare('SELECT * FROM release_votes WHERE request_id = ?')
      return stmt.all(requestId)
    },

    // -------------------------------------------------------------------------
    // DISCLOSURE RECEIPTS
    // -------------------------------------------------------------------------
    saveDisclosureReceipt({ receiptId, capsuleId, recipientWallet, detailsJson }) {
      const now = new Date().toISOString()
      const stmt = db.prepare(`
        INSERT INTO disclosure_receipts (receipt_id, capsule_id, recipient_wallet, released_at, details_json)
        VALUES (?, ?, ?, ?, ?)
      `)
      stmt.run(receiptId, capsuleId, recipientWallet.toLowerCase(), now, typeof detailsJson === 'string' ? detailsJson : JSON.stringify(detailsJson))
      return this.getDisclosureReceipt(receiptId)
    },

    getDisclosureReceipt(receiptId) {
      const stmt = db.prepare('SELECT * FROM disclosure_receipts WHERE receipt_id = ?')
      const row = stmt.get(receiptId)
      if (!row) return null
      return { ...row, details: JSON.parse(row.details_json) }
    },

    // -------------------------------------------------------------------------
    // NOTIFICATIONS
    // -------------------------------------------------------------------------
    createNotification({ id, recipientWallet, type, title, body, link = null }) {
      const now = new Date().toISOString()
      const stmt = db.prepare(`
        INSERT INTO notifications (id, recipient_wallet, type, title, body, link, read, created_at)
        VALUES (?, ?, ?, ?, ?, ?, 0, ?)
      `)
      stmt.run(id, recipientWallet.toLowerCase(), type, title, body, link, now)
    },

    getUserNotifications(walletAddress) {
      const stmt = db.prepare('SELECT * FROM notifications WHERE recipient_wallet = ? ORDER BY created_at DESC LIMIT 50')
      return stmt.all(walletAddress.toLowerCase())
    },

    markNotificationRead(id) {
      db.prepare('UPDATE notifications SET read = 1 WHERE id = ?').run(id)
    },
  }
}
