'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/providers';
import { Lock, Plus, Clock, Users, ArrowRight, Shield } from 'lucide-react';

export default function CapsulesListPage() {
  const { token } = useAuth();
  const [capsules, setCapsules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      loadCapsules();
    }
  }, [token]);

  const loadCapsules = async () => {
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

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      <div className="flex items-center justify-between p-6 rounded-lg bg-[#1D2115] border border-[#3A402C]">
        <div>
          <h1 className="text-sm font-bold text-[#F3F0E4] uppercase tracking-wider flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#858C50]" /> Secret Capsules
          </h1>
          <p className="text-xs text-[#A9A58D] mt-1">
            Encrypted capsules governed by smart contract policies and independent guardians.
          </p>
        </div>
        <Link
          href="/app/capsules/create"
          className="px-4 py-2 rounded bg-[#858C50] hover:bg-[#B2B77A] text-[#12150D] text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> New Capsule
        </Link>
      </div>

      <div className="space-y-3">
        {capsules.length === 0 ? (
          <div className="p-12 rounded-lg bg-[#1D2115] border border-[#3A402C] text-center space-y-3">
            <Lock className="w-8 h-8 text-[#A9A58D] mx-auto opacity-30" />
            <p className="text-xs text-[#A9A58D]">No capsules registered. Create your first capsule now.</p>
          </div>
        ) : (
          capsules.map((cap) => (
            <div
              key={cap.capsule_id}
              className="p-5 rounded-lg bg-[#1D2115] border border-[#3A402C] hover:border-[#858C50] transition-colors flex items-center justify-between"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-[#F3F0E4]">{cap.title}</h3>
                  <span className="px-2 py-0.5 rounded text-[9px] font-mono uppercase bg-[#252A1B] text-[#E6D98D] border border-[#3A402C]">
                    {cap.access_mode}
                  </span>
                </div>
                <div className="font-mono text-[10px] text-[#A9A58D]">
                  ID: {cap.capsule_id}
                </div>
              </div>

              <div className="flex items-center gap-4">
                <div className="text-right text-[10px] text-[#A9A58D]">
                  <div>Threshold: {cap.approval_threshold}-of-{cap.approvers?.length || 3}</div>
                  <div>Unlock: {new Date(cap.unlock_timestamp * 1000).toLocaleTimeString()}</div>
                </div>

                <Link
                  href={`/app/capsules/${cap.capsule_id}`}
                  className="px-3 py-1.5 rounded bg-[#303624] hover:bg-[#3A402C] text-xs font-semibold text-[#F3F0E4] flex items-center gap-1"
                >
                  Inspect <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
