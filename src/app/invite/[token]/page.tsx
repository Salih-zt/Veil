'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { Shield, Layers, ArrowRight, CheckCircle2, AlertTriangle, Wallet } from 'lucide-react';

export default function InviteOnboardingPage() {
  const params = useParams();
  const tokenParam = params?.token as string;
  const router = useRouter();
  const { user, token, connectWallet } = useAuth();

  const [invitation, setInvitation] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    if (tokenParam) {
      loadInvitation();
    }
  }, [tokenParam]);

  const loadInvitation = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/invitations/${tokenParam}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Invalid invitation token');
      setInvitation(data.invitation);
    } catch (err: any) {
      setErrorMsg(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAccept = async () => {
    if (!token) {
      alert('Please connect your Web3 wallet first');
      return;
    }

    setIsAccepting(true);
    try {
      const res = await fetch(`/api/invitations/${tokenParam}/accept`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Acceptance failed');

      alert('Welcome to the room!');
      router.push(`/app/rooms/${data.roomId}`);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setIsAccepting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen bg-[#171A10] flex items-center justify-center text-xs text-[#A9A58D]">Loading invitation...</div>;
  }

  if (errorMsg) {
    return (
      <div className="min-h-screen bg-[#171A10] flex items-center justify-center p-6">
        <div className="max-w-md p-8 rounded-lg bg-[#1D2115] border border-red-900/40 text-center space-y-4">
          <AlertTriangle className="w-8 h-8 text-red-400 mx-auto" />
          <h2 className="text-base font-bold text-[#F3F0E4]">Invalid Invitation</h2>
          <p className="text-xs text-[#A9A58D]">{errorMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#171A10] flex items-center justify-center px-6 py-12">
      <div className="w-full max-w-md p-8 rounded-lg bg-[#1D2115] border border-[#3A402C] shadow-2xl space-y-6">
        <div className="text-center space-y-2">
          <div className="w-10 h-10 rounded bg-[#858C50] text-[#12150D] flex items-center justify-center font-bold mx-auto mb-2">
            <Layers className="w-5 h-5 text-[#12150D]" />
          </div>
          <h1 className="text-xl font-bold text-[#F3F0E4]">Room Invitation</h1>
          <p className="text-xs text-[#A9A58D]">
            You have been invited to join <strong className="text-[#E6D98D]">{invitation?.roomName}</strong>.
          </p>
        </div>

        <div className="p-4 rounded bg-[#252A1B] border border-[#3A402C] space-y-2 text-xs">
          <div className="flex justify-between">
            <span className="text-[#A9A58D]">Assigned Role:</span>
            <span className="font-mono text-[#E6D98D] uppercase font-bold">{invitation?.targetRole}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A9A58D]">Inviter:</span>
            <span className="font-mono text-[#F3F0E4]">{invitation?.inviterAddress?.slice(0, 8)}...</span>
          </div>
        </div>

        {!user ? (
          <button
            onClick={connectWallet}
            className="w-full py-3.5 rounded bg-[#E6D98D] hover:bg-[#F3F0E4] text-[#12150D] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
          >
            <Wallet className="w-4 h-4" /> Connect Wallet to Accept
          </button>
        ) : (
          <button
            onClick={handleAccept}
            disabled={isAccepting}
            className="w-full py-3.5 rounded bg-[#858C50] hover:bg-[#B2B77A] text-[#12150D] font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md disabled:opacity-50"
          >
            <CheckCircle2 className="w-4 h-4" />
            {isAccepting ? 'Joining Room...' : 'Accept & Join Private Room'}
          </button>
        )}
      </div>
    </div>
  );
}
