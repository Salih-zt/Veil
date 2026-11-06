'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/providers';
import { Inbox, KeyRound, ArrowRight, Clock, Shield } from 'lucide-react';

export default function ReceivedCapsulesPage() {
  const { user, token } = useAuth();
  const [capsules, setCapsules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      loadReceivedCapsules();
    }
  }, [token]);

  const loadReceivedCapsules = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/capsules', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        // Filter capsules addressed to caller
        const myCaps = (data.capsules || []).filter(
          (c: any) =>
            c.access_mode === 'bearer' ||
            (c.recipients || []).map((r: string) => r.toLowerCase()).includes(user?.wallet_address.toLowerCase())
        );
        setCapsules(myCaps);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C]">
        <h1 className="text-sm font-bold text-[#F3F0E4] uppercase tracking-wider flex items-center gap-2">
          <Inbox className="w-4 h-4 text-[#858C50]" /> Received Capsules Inbox
        </h1>
        <p className="text-xs text-[#A9A58D] mt-1">
          Confidential capsules addressed specifically to your verified wallet address.
        </p>
      </div>

      <div className="space-y-4">
        {capsules.length === 0 ? (
          <div className="p-12 rounded-lg bg-[#1D2115] border border-[#3A402C] text-center space-y-3">
            <Inbox className="w-8 h-8 text-[#A9A58D] mx-auto opacity-30" />
            <p className="text-xs text-[#A9A58D]">No incoming capsules found for your wallet.</p>
          </div>
        ) : (
          capsules.map((cap) => (
            <div
              key={cap.capsule_id}
              className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#F3F0E4]">{cap.title}</h3>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase bg-[#252A1B] text-[#E6D98D] border border-[#3A402C]">
                    {cap.access_mode}
                  </span>
                </div>
                <div className="font-mono text-[10px] text-[#A9A58D]">
                  Capsule ID: {cap.capsule_id}
                </div>
                <div className="text-[11px] text-[#A9A58D]">
                  Unlock: {new Date(cap.unlock_timestamp * 1000).toLocaleTimeString()} &bull; Threshold: {cap.approval_threshold}-of-{cap.approvers?.length || 3}
                </div>
              </div>

              <Link
                href={`/app/decoder?capsule=${cap.capsule_id}`}
                className="px-4 py-2 rounded bg-[#E6D98D] hover:bg-[#F3F0E4] text-[#12150D] text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
              >
                <KeyRound className="w-3.5 h-3.5" /> Decrypt in Portal
              </Link>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
