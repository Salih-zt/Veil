'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers';
import { CheckSquare, Shield, Clock, ArrowRight, CheckCircle2, AlertCircle } from 'lucide-react';

export default function ApprovalsPage() {
  const { user, token } = useAuth();
  const [capsules, setCapsules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    if (token) {
      loadPendingApprovals();
    }
  }, [token]);

  const loadPendingApprovals = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/capsules', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCapsules(data.capsules || []);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (capsuleId: string) => {
    setApprovingId(capsuleId);
    try {
      let signature = '0x' + '11'.repeat(65);

      if (typeof window !== 'undefined' && (window as any).ethereum) {
        try {
          const message = `Approve disclosure for VEIL Capsule: ${capsuleId}\nSigner: ${user?.wallet_address}`;
          signature = await (window as any).ethereum.request({
            method: 'personal_sign',
            params: [message, user?.wallet_address],
          });
        } catch {
          // Dev fallback
        }
      }

      const res = await fetch(`/api/capsules/${capsuleId}/approve`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ signature }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Approval failed');

      alert(`Approval recorded! Current quorum: ${data.approvalsCount} of ${data.threshold}`);
      loadPendingApprovals();
    } catch (err: any) {
      alert('Approval Error: ' + err.message);
    } finally {
      setApprovingId(null);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C]">
        <h1 className="text-sm font-bold text-[#F3F0E4] uppercase tracking-wider flex items-center gap-2">
          <CheckSquare className="w-4 h-4 text-[#858C50]" /> Reviewer Approval Center
        </h1>
        <p className="text-xs text-[#A9A58D] mt-1">
          Review pending secret disclosure requests and sign cryptographic approval authorizations.
        </p>
      </div>

      {/* Reviewer Role Notice */}
      <div className="p-4 rounded-lg bg-[#252A1B] border border-[#3A402C] flex items-center justify-between text-xs">
        <div>
          <div className="font-semibold text-[#F3F0E4]">Active Signer Wallet</div>
          <div className="font-mono text-[10px] text-[#A9A58D]">{user?.wallet_address}</div>
        </div>
        <div className="text-right">
          <span className="px-2 py-0.5 rounded bg-[#858C50]/20 text-[#B2B77A] border border-[#858C50] text-[10px] font-mono">
            {user?.ens_name || 'Designated Reviewer'}
          </span>
        </div>
      </div>

      {/* Capsules Table */}
      <div className="space-y-4">
        {capsules.length === 0 ? (
          <div className="p-12 rounded-lg bg-[#1D2115] border border-[#3A402C] text-center space-y-3">
            <CheckSquare className="w-8 h-8 text-[#A9A58D] mx-auto opacity-30" />
            <p className="text-xs text-[#A9A58D]">No pending capsule approvals assigned to this wallet.</p>
          </div>
        ) : (
          capsules.map((cap) => (
            <div
              key={cap.capsule_id}
              className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-sm font-bold text-[#F3F0E4]">{cap.title}</h3>
                  <div className="font-mono text-[10px] text-[#A9A58D] mt-0.5">
                    Capsule ID: {cap.capsule_id}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#252A1B] border border-[#3A402C] text-[#E6D98D]">
                  {cap.access_mode}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-4 p-3 rounded bg-[#252A1B] text-xs">
                <div>
                  <span className="text-[#A9A58D] block text-[10px] uppercase">Required Quorum</span>
                  <span className="font-bold text-[#E6D98D]">
                    {cap.approval_threshold} of {cap.approvers?.length || 3} Approvals
                  </span>
                </div>
                <div>
                  <span className="text-[#A9A58D] block text-[10px] uppercase">Unlock Time</span>
                  <span className="text-[#F3F0E4]">
                    {new Date(cap.unlock_timestamp * 1000).toLocaleTimeString()}
                  </span>
                </div>
                <div>
                  <span className="text-[#A9A58D] block text-[10px] uppercase">Creator</span>
                  <span className="font-mono text-[10px] text-[#A9A58D]">
                    {cap.creator_wallet?.slice(0, 8)}...
                  </span>
                </div>
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => handleApprove(cap.capsule_id)}
                  disabled={approvingId === cap.capsule_id}
                  className="px-5 py-2 rounded bg-[#858C50] hover:bg-[#B2B77A] text-[#12150D] font-bold text-xs flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
                >
                  <CheckSquare className="w-3.5 h-3.5" />
                  {approvingId === cap.capsule_id ? 'Signing...' : 'Sign Approval'}
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
