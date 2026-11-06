'use client';

import React, { useState, useEffect } from 'react';
import { useAuth } from '@/app/providers';
import { FileText, Shield, CheckCircle2, Clock, ExternalLink } from 'lucide-react';

export default function HistoryPage() {
  const { user, token } = useAuth();
  const [capsules, setCapsules] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      loadHistory();
    }
  }, [token]);

  const loadHistory = async () => {
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
      {/* Header */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C]">
        <h1 className="text-sm font-bold text-[#F3F0E4] uppercase tracking-wider flex items-center gap-2">
          <FileText className="w-4 h-4 text-[#858C50]" /> Cryptographic Disclosure Receipts
        </h1>
        <p className="text-xs text-[#A9A58D] mt-1">
          Verifiable audit trail proving onchain policy commitment, reviewer quorum, and guardian delivery.
        </p>
      </div>

      {/* History Items */}
      <div className="space-y-4">
        {capsules.length === 0 ? (
          <div className="p-12 rounded-lg bg-[#1D2115] border border-[#3A402C] text-center space-y-3">
            <FileText className="w-8 h-8 text-[#A9A58D] mx-auto opacity-30" />
            <p className="text-xs text-[#A9A58D]">No historical disclosure receipts on record.</p>
          </div>
        ) : (
          capsules.map((cap) => (
            <div
              key={cap.capsule_id}
              className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4"
            >
              <div className="flex items-center justify-between border-b border-[#2D3321] pb-3">
                <div>
                  <h3 className="text-sm font-bold text-[#F3F0E4]">{cap.title}</h3>
                  <div className="font-mono text-[10px] text-[#A9A58D]">
                    Capsule ID: {cap.capsule_id}
                  </div>
                </div>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#252A1B] text-[#858C50] border border-[#3A402C]">
                  {cap.status}
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs font-mono">
                <div>
                  <span className="text-[10px] text-[#A9A58D] block">POLICY HASH</span>
                  <span className="text-[#E6D98D] text-[10px] truncate block">
                    {cap.policy_hash?.slice(0, 14)}...
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#A9A58D] block">APPROVALS</span>
                  <span className="text-[#F3F0E4] text-[10px] block">
                    {cap.approval_threshold}-of-{cap.approvers?.length || 3} Quorum
                  </span>
                </div>
                <div>
                  <span className="text-[10px] text-[#A9A58D] block">GUARDIANS</span>
                  <span className="text-[#858C50] text-[10px] block">2 of 3 Shares</span>
                </div>
                <div>
                  <span className="text-[10px] text-[#A9A58D] block">CREATED</span>
                  <span className="text-[#A9A58D] text-[10px] block">
                    {new Date(cap.created_at).toLocaleDateString()}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
