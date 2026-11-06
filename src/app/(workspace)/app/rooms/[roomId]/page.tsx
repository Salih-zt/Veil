'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers';
import {
  Layers,
  Users,
  Lock,
  Plus,
  Mail,
  Copy,
  Shield,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';

export default function RoomDetailPage() {
  const params = useParams();
  const roomId = params?.roomId as string;
  const { user, token } = useAuth();

  const [room, setRoom] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  // Invite state
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'approver' | 'recipient' | 'observer'>('approver');
  const [generatedInviteLink, setGeneratedInviteLink] = useState<string | null>(null);
  const [isInviting, setIsInviting] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (token && roomId) {
      loadRoom();
    }
  }, [token, roomId]);

  const loadRoom = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRoom(data.room);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsInviting(true);
    try {
      const res = await fetch(`/api/rooms/${roomId}/invitations`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: inviteEmail || null, role: inviteRole }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invitation failed');

      setGeneratedInviteLink(data.inviteLink);
      setInviteEmail('');
    } catch (err: any) {
      alert('Invite Error: ' + err.message);
    } finally {
      setIsInviting(false);
    }
  };

  const copyInvite = () => {
    if (!generatedInviteLink) return;
    navigator.clipboard.writeText(generatedInviteLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-[#A9A58D]">Loading room...</div>;
  }

  if (!room) {
    return <div className="p-12 text-center text-xs text-red-400">Room not found or access denied.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded bg-[#252A1B] text-[#E6D98D] text-[10px] font-mono uppercase">
              {room.status || 'Active'}
            </span>
            <span className="font-mono text-[10px] text-[#A9A58D]">ID: {room.id}</span>
          </div>
          <h1 className="text-xl font-bold text-[#F3F0E4]">{room.name}</h1>
          <p className="text-xs text-[#A9A58D] mt-1">{room.description}</p>
        </div>

        <Link
          href="/app/capsules/create"
          className="px-4 py-2 rounded bg-[#858C50] hover:bg-[#B2B77A] text-[#12150D] text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Encrypt in Room
        </Link>
      </div>

      {/* Invite Member Section */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4">
        <h2 className="text-xs font-bold text-[#F3F0E4] uppercase tracking-wider flex items-center gap-2">
          <Mail className="w-3.5 h-3.5 text-[#858C50]" /> Invite Participant
        </h2>

        <form onSubmit={handleSendInvite} className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <input
            type="email"
            value={inviteEmail}
            onChange={(e) => setInviteEmail(e.target.value)}
            placeholder="Participant email (optional)"
            className="bg-[#12150D] border border-[#3A402C] rounded p-2.5 text-xs text-[#F3F0E4] outline-none"
          />

          <select
            value={inviteRole}
            onChange={(e: any) => setInviteRole(e.target.value)}
            className="bg-[#12150D] border border-[#3A402C] rounded p-2.5 text-xs text-[#F3F0E4] outline-none"
          >
            <option value="approver">Designated Approver (Reviewer)</option>
            <option value="recipient">Authorized Recipient</option>
            <option value="observer">Observer (Auditor)</option>
          </select>

          <button
            type="submit"
            disabled={isInviting}
            className="px-4 py-2.5 rounded bg-[#252A1B] hover:bg-[#303624] border border-[#3A402C] text-[#E6D98D] text-xs font-bold transition-all disabled:opacity-50"
          >
            {isInviting ? 'Generating...' : 'Create Invite Link'}
          </button>
        </form>

        {generatedInviteLink && (
          <div className="p-3 rounded bg-[#12150D] border border-[#858C50] flex items-center justify-between gap-3 text-xs">
            <span className="font-mono text-[11px] text-[#E6D98D] truncate">
              {generatedInviteLink}
            </span>
            <button
              onClick={copyInvite}
              className="px-3 py-1 rounded bg-[#858C50] text-[#12150D] font-bold text-[11px] shrink-0"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* Members List */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4">
        <h2 className="text-xs font-bold text-[#F3F0E4] uppercase tracking-wider flex items-center gap-2">
          <Users className="w-3.5 h-3.5 text-[#858C50]" /> Active Room Members ({room.members?.length || 1})
        </h2>

        <div className="divide-y divide-[#2D3321]">
          {(room.members || []).map((m: any, idx: number) => (
            <div key={idx} className="py-3 flex items-center justify-between text-xs">
              <div className="space-y-0.5">
                <div className="font-mono text-[#F3F0E4]">
                  {m.wallet_address.slice(0, 10)}...{m.wallet_address.slice(-8)}
                </div>
                <div className="text-[10px] text-[#A9A58D]">
                  {m.ens_name ? `${m.ens_name} • ` : ''}Joined {new Date(m.joined_at).toLocaleDateString()}
                </div>
              </div>
              <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#252A1B] text-[#E6D98D] border border-[#3A402C]">
                {m.role}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
