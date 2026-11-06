// VEIL Protocol — Unified Type Definitions

export type UserRole = 'owner' | 'approver' | 'recipient' | 'observer';

export interface User {
  id: string;
  wallet_address: string;
  email?: string | null;
  email_verified: boolean;
  email_verified_at?: string | null;
  ens_name?: string | null;
  ens_verified: boolean;
  ens_verified_at?: string | null;
  world_id_verified: boolean;
  world_id_nullifier?: string | null;
  world_id_verified_at?: string | null;
  created_at: string;
  status: 'active' | 'suspended';
}

export interface AuthSession {
  token: string;
  user_id: string;
  wallet_address: string;
  created_at: string;
  expires_at: string;
  user?: User;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  owner_id: string;
  owner_address: string;
  created_at: string;
  status: 'active' | 'archived';
  member_count?: number;
  capsule_count?: number;
  members?: RoomMember[];
}

export interface RoomMember {
  room_id: string;
  user_id: string;
  wallet_address: string;
  role: UserRole;
  joined_at: string;
  ens_name?: string | null;
  world_id_verified?: boolean;
}

export interface RoomInvitation {
  id: string;
  room_id: string;
  room_name?: string;
  inviter_address: string;
  target_email?: string | null;
  target_role: UserRole;
  token_hash: string;
  expires_at: string;
  status: 'pending' | 'accepted' | 'expired';
}

export type CapsuleStatus =
  | 'draft'
  | 'encrypting'
  | 'awaiting_registration'
  | 'locked'
  | 'awaiting_approvals'
  | 'awaiting_authorization'
  | 'eligible_for_release'
  | 'releasing'
  | 'disclosed'
  | 'expired'
  | 'revoked'
  | 'failed';

export interface Capsule {
  id: string; // bytes32 hex
  room_id?: string;
  creator_address: string;
  title: string;
  access_mode: 'named' | 'bearer';
  policy_hash: string;
  ciphertext_hash: string;
  carrier_text?: string;
  ciphertext_payload?: string;
  unlock_timestamp: number;
  expiry_timestamp: number;
  approval_threshold: number;
  guardian_threshold: number;
  reviewer_count: number;
  status: CapsuleStatus;
  created_at: string;
  tx_hash?: string;
  recipients?: string[];
  approvers?: string[];
  approvals_received?: string[];
  shares_delivered?: number;
}

export interface ReviewerVote {
  id: string;
  capsule_id: string;
  reviewer_address: string;
  signature: string;
  voted_at: string;
  tx_hash?: string;
}

export interface ReleaseRequest {
  id: string;
  capsule_id: string;
  recipient_address: string;
  recipient_pubkey: string;
  status: 'pending' | 'ready' | 'released' | 'denied';
  created_at: string;
  denial_reason?: string;
}

export interface GuardianNode {
  id: string;
  name: string;
  url: string;
  public_key: string;
  status: 'online' | 'offline' | 'degraded';
  last_heartbeat: string;
  shares_stored: number;
}

export interface DisclosureReceipt {
  receipt_id: string;
  capsule_id: string;
  recipient_address: string;
  world_id_nullifier?: string;
  timestamp: string;
  verified_guardians: string[];
  policy_hash: string;
  signatures: Record<string, string>;
  client_decryption_verified: boolean;
}
