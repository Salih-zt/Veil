'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers';
import {
  Lock,
  Clock,
  Shield,
  KeyRound,
  FileText,
  Copy,
  ExternalLink,
  ArrowRight,
  AlertTriangle,
} from 'lucide-react';

export default function CapsuleDetailPage() {
  const params = useParams();
  const capsuleId = params?.capsuleId as string;
  const router = useRouter();
  const { user, token } = useAuth();

  const [capsule, setCapsule] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (capsuleId) {
      loadCapsule();
    }
  }, [capsuleId]);

  const loadCapsule = async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/capsules/${capsuleId}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Capsule not found');
      setCapsule(data.capsule);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const copyCarrier = () => {
    if (!capsule?.carrier_text) return;
    navigator.clipboard.writeText(capsule.carrier_text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return <div className="p-12 text-center text-xs text-[#A9A58D]">Loading capsule...</div>;
  }

  if (!capsule) {
    return <div className="p-12 text-center text-xs text-red-400">Capsule not found.</div>;
  }

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#252A1B] text-[#E6D98D] border border-[#3A402C]">
              {capsule.conditionStatus || 'Locked'}
            </span>
            <span className="font-mono text-[10px] text-[#A9A58D]">ID: {capsule.capsule_id}</span>
          </div>
          <h1 className="text-xl font-bold text-[#F3F0E4]">{capsule.title}</h1>
        </div>

        <Link
          href={`/app/decoder?capsule=${capsule.capsule_id}`}
          className="px-4 py-2 rounded bg-[#E6D98D] hover:bg-[#F3F0E4] text-[#12150D] text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
        >
          <KeyRound className="w-3.5 h-3.5" /> Open in Decoder
        </Link>
      </div>

      {/* Denial Reason Explanation if Locked */}
      {capsule.denialReason && (
        <div className="p-4 rounded-lg bg-amber-950/20 border border-amber-900/40 text-amber-200 text-xs flex items-center gap-3">
          <AlertTriangle className="w-4 h-4 shrink-0 text-amber-400" />
          <div>
            <strong>Access Condition:</strong> {capsule.denialReason}
          </div>
        </div>
      )}

      {/* Cryptographic Parameters Grid */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4">
        <h2 className="text-xs font-bold text-[#F3F0E4] uppercase tracking-wider">
          Cryptographic Descriptor & Envelope
        </h2>

        <div className="p-4 rounded bg-[#252A1B] border border-[#3A402C] space-y-3 text-xs font-mono">
          <div className="flex justify-between border-b border-[#2D3321] pb-2">
            <span className="text-[#A9A58D]">Ciphertext Hash:</span>
            <span className="text-[#F3F0E4] truncate max-w-md">{capsule.ciphertext_hash}</span>
          </div>
          <div className="flex justify-between border-b border-[#2D3321] pb-2">
            <span className="text-[#A9A58D]">Policy Hash:</span>
            <span className="text-[#E6D98D] truncate max-w-md">{capsule.policy_hash}</span>
          </div>
          <div className="flex justify-between border-b border-[#2D3321] pb-2">
            <span className="text-[#A9A58D]">Encryption AEAD:</span>
            <span className="text-[#F3F0E4]">AES-256-SIV Deterministic</span>
          </div>
          <div className="flex justify-between border-b border-[#2D3321] pb-2">
            <span className="text-[#A9A58D]">Reviewer Quorum:</span>
            <span className="text-[#E6D98D] font-bold">
              {capsule.approvalsCount || 0} of {capsule.approval_threshold} Signed
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[#A9A58D]">Guardian Quorum:</span>
            <span className="text-[#858C50] font-bold">2 of 3 Shares Required</span>
          </div>
        </div>
      </div>

      {/* Steganographic Carrier Text */}
      {capsule.carrier_text && (
        <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold text-[#F3F0E4] uppercase tracking-wider">
              Natural-Language Carrier Text
            </h2>
            <button
              onClick={copyCarrier}
              className="text-xs text-[#E6D98D] hover:underline flex items-center gap-1"
            >
              <Copy className="w-3.5 h-3.5" /> {copied ? 'Copied!' : 'Copy Carrier'}
            </button>
          </div>
          <div className="p-4 rounded bg-[#12150D] font-mono text-xs text-[#A9A58D] leading-relaxed border border-[#2D3321]">
            {capsule.carrier_text}
          </div>
        </div>
      )}
    </div>
  );
}
