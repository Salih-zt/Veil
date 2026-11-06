'use client';

import React from 'react';
import { useAuth } from '@/app/providers';
import { Settings, Shield, Wallet, Bell, Database } from 'lucide-react';

export default function SettingsPage() {
  const { user } = useAuth();

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C]">
        <h1 className="text-sm font-bold text-[#F3F0E4] uppercase tracking-wider flex items-center gap-2">
          <Settings className="w-4 h-4 text-[#858C50]" /> Workspace Settings & Preferences
        </h1>
        <p className="text-xs text-[#A9A58D] mt-1">
          Manage local cryptography settings, active network RPCs, and notification preferences.
        </p>
      </div>

      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-6">
        <h2 className="text-xs font-bold text-[#F3F0E4] uppercase tracking-wider">
          Network & Storage Configuration
        </h2>

        <div className="space-y-4 text-xs font-mono">
          <div>
            <label className="text-[#A9A58D] block mb-1">EVM JSON-RPC Endpoint</label>
            <input
              type="text"
              readOnly
              value="http://127.0.0.1:8545 (Anvil Local Devnet)"
              className="w-full bg-[#12150D] border border-[#3A402C] rounded p-2.5 text-[#F3F0E4] outline-none"
            />
          </div>

          <div>
            <label className="text-[#A9A58D] block mb-1">Policy Registry Contract Address</label>
            <input
              type="text"
              readOnly
              value="0x5FbDB2315678afecb367f032d93F642f64180aa3"
              className="w-full bg-[#12150D] border border-[#3A402C] rounded p-2.5 text-[#E6D98D] outline-none"
            />
          </div>

          <div>
            <label className="text-[#A9A58D] block mb-1">Local ACID Relational Database</label>
            <input
              type="text"
              readOnly
              value="apps/api/data/veil.sqlite (SQLite WAL Mode)"
              className="w-full bg-[#12150D] border border-[#3A402C] rounded p-2.5 text-[#858C50] outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
