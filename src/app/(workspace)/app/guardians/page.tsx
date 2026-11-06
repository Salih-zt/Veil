'use client';

import React, { useState, useEffect } from 'react';
import { Server, Shield, CheckCircle2, AlertTriangle, Key, Cpu } from 'lucide-react';

export default function GuardiansPage() {
  const [clusterData, setClusterData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadGuardians();
  }, []);

  const loadGuardians = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/guardians/status');
      if (res.ok) {
        const data = await res.json();
        setClusterData(data);
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
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-sm font-bold text-[#F3F0E4] uppercase tracking-wider flex items-center gap-2">
              <Server className="w-4 h-4 text-[#858C50]" /> Independent Guardian Network
            </h1>
            <p className="text-xs text-[#A9A58D] mt-1">
              Threshold key custody cluster enforcing onchain policy verification before releasing Shamir shares.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded bg-[#858C50]/20 text-[#858C50] border border-[#858C50] text-xs font-mono font-bold">
            2-of-3 Quorum
          </span>
        </div>
      </div>

      {/* Trust Domain Notice */}
      <div className="p-4 rounded-lg bg-[#252A1B] border border-[#3A402C] text-xs text-[#A9A58D] leading-relaxed space-y-2">
        <div className="font-semibold text-[#E6D98D] flex items-center gap-1.5">
          <Shield className="w-4 h-4 text-[#858C50]" /> Security & Trust Domain Architecture
        </div>
        <p>
          In production deployments, each guardian node operates inside an isolated cloud enclave (e.g. AWS Nitro Enclaves or Hardware Security Modules) managed by distinct organizational custodians. In this local evaluation environment, 3 independent node processes run on isolated ports (8791, 8792, 8793) with dedicated encrypted SQLite keystores.
        </p>
      </div>

      {/* Nodes Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {clusterData?.nodes?.map((node: any) => (
          <div key={node.id} className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4">
            <div className="flex items-center justify-between border-b border-[#2D3321] pb-3">
              <h3 className="text-sm font-bold text-[#F3F0E4]">{node.name}</h3>
              <span className="px-2 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-[10px] font-mono">
                {node.status}
              </span>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <span className="text-[10px] font-mono uppercase text-[#A9A58D] block mb-1">
                  X25519 Public Key
                </span>
                <div className="p-2 rounded bg-[#12150D] font-mono text-[10px] text-[#E6D98D] break-all border border-[#2D3321]">
                  {node.publicKey}
                </div>
              </div>

              <div className="flex justify-between border-t border-[#2D3321] pt-2">
                <span className="text-[#A9A58D]">Listen Port:</span>
                <span className="font-mono text-[#F3F0E4]">{node.port}</span>
              </div>

              <div className="flex justify-between border-t border-[#2D3321] pt-2">
                <span className="text-[#A9A58D]">Share Storage:</span>
                <span className="text-[#858C50]">Encrypted SQLite</span>
              </div>

              <div className="flex justify-between border-t border-[#2D3321] pt-2">
                <span className="text-[#A9A58D]">Attestation:</span>
                <span className="font-mono text-[#A9A58D]">ECDSA secp256k1</span>
              </div>
            </div>
          </div>
        )) || (
          <div className="col-span-3 p-12 text-center text-xs text-[#A9A58D]">Loading guardian nodes...</div>
        )}
      </div>
    </div>
  );
}
