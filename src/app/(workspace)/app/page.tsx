'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/providers';
import {
  Lock,
  Clock,
  CheckCircle2,
  AlertCircle,
  Layers,
  KeyRound,
  Shield,
  ArrowRight,
  Server,
  Users,
} from 'lucide-react';

export default function WorkspaceOverview() {
  const { user, token } = useAuth();
  const [capsules, setCapsules] = useState<any[]>([]);
  const [rooms, setRooms] = useState<any[]>([]);
  const [guardianStatus, setGuardianStatus] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      loadDashboardData();
    }
  }, [token]);

  const loadDashboardData = async () => {
    setLoading(true);
    try {
      // 1. Fetch user capsules
      const capRes = await fetch('/api/capsules', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (capRes.ok) {
        const data = await capRes.json();
        setCapsules(data.capsules || []);
      }

      // 2. Fetch user rooms
      const roomRes = await fetch('/api/rooms', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (roomRes.ok) {
        const data = await roomRes.json();
        setRooms(data.rooms || []);
      }

      // 3. Fetch guardian status
      const guardRes = await fetch('/api/guardians/status');
      if (guardRes.ok) {
        const data = await guardRes.json();
        setGuardianStatus(data);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-8 max-w-6xl">
      {/* Welcome Banner */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-[#F3F0E4]">
            Welcome back, <span className="text-[#E6D98D]">{user?.ens_name || 'Protocol Participant'}</span>
          </h1>
          <p className="text-xs text-[#A9A58D] mt-1 font-mono">
            Wallet: {user?.wallet_address || '0x...'} &bull; Status: Active Session
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/app/capsules/create"
            className="px-4 py-2 rounded bg-[#E6D98D] hover:bg-[#F3F0E4] text-[#12150D] text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
          >
            <Lock className="w-3.5 h-3.5" /> Encrypt Capsule
          </Link>
          <Link
            href="/app/rooms/create"
            className="px-4 py-2 rounded bg-[#252A1B] hover:bg-[#303624] border border-[#3A402C] text-[#F3F0E4] text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <Layers className="w-3.5 h-3.5" /> Create Room
          </Link>
          <Link
            href="/app/decoder"
            className="px-4 py-2 rounded bg-[#252A1B] hover:bg-[#303624] border border-[#3A402C] text-[#F3F0E4] text-xs font-semibold transition-all flex items-center gap-1.5"
          >
            <KeyRound className="w-3.5 h-3.5" /> Decoder
          </Link>
        </div>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <div className="p-5 rounded-lg bg-[#252A1B] border border-[#3A402C]">
          <div className="text-[10px] font-mono uppercase text-[#A9A58D]">Active Rooms</div>
          <div className="text-2xl font-bold text-[#E6D98D] mt-1">{rooms.length}</div>
          <div className="text-[10px] text-[#858C50] mt-1">Multi-tenant collaboration spaces</div>
        </div>

        <div className="p-5 rounded-lg bg-[#252A1B] border border-[#3A402C]">
          <div className="text-[10px] font-mono uppercase text-[#A9A58D]">Total Capsules</div>
          <div className="text-2xl font-bold text-[#E6D98D] mt-1">{capsules.length}</div>
          <div className="text-[10px] text-[#858C50] mt-1">Client-side AES-256-SIV AEAD</div>
        </div>

        <div className="p-5 rounded-lg bg-[#252A1B] border border-[#3A402C]">
          <div className="text-[10px] font-mono uppercase text-[#A9A58D]">Pending Approvals</div>
          <div className="text-2xl font-bold text-[#E6D98D] mt-1">
            {capsules.filter((c) => c.status === 'locked' || c.status === 'awaiting_approvals').length}
          </div>
          <div className="text-[10px] text-[#A9A58D] mt-1">Awaiting reviewer quorum</div>
        </div>

        <div className="p-5 rounded-lg bg-[#252A1B] border border-[#3A402C]">
          <div className="text-[10px] font-mono uppercase text-[#A9A58D]">Guardian Nodes</div>
          <div className="text-2xl font-bold text-[#858C50] mt-1">
            {guardianStatus?.nodes?.length || 3} / 3 Online
          </div>
          <div className="text-[10px] text-[#858C50] mt-1">2-of-3 threshold quorum active</div>
        </div>
      </div>

      {/* Main Grid: Recent Capsules + Guardian Health */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Capsules List (2 Cols) */}
        <div className="lg:col-span-2 p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4">
          <div className="flex items-center justify-between border-b border-[#2D3321] pb-3">
            <h2 className="text-sm font-bold text-[#F3F0E4] uppercase tracking-wider">Recent Secret Capsules</h2>
            <Link href="/app/capsules" className="text-xs text-[#E6D98D] hover:underline flex items-center gap-1">
              View All <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          {capsules.length === 0 ? (
            <div className="text-center py-10 space-y-3">
              <Lock className="w-8 h-8 text-[#A9A58D] mx-auto opacity-40" />
              <p className="text-xs text-[#A9A58D]">No secret capsules found in your connected rooms.</p>
              <Link
                href="/app/capsules/create"
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded bg-[#858C50] text-[#12150D] text-xs font-semibold hover:bg-[#B2B77A]"
              >
                Create First Capsule
              </Link>
            </div>
          ) : (
            <div className="space-y-3">
              {capsules.slice(0, 5).map((cap) => (
                <div
                  key={cap.capsule_id}
                  className="p-4 rounded bg-[#252A1B] border border-[#3A402C] hover:border-[#858C50] transition-colors flex items-center justify-between"
                >
                  <div className="space-y-1">
                    <div className="text-xs font-bold text-[#F3F0E4]">{cap.title}</div>
                    <div className="font-mono text-[10px] text-[#A9A58D]">
                      ID: {cap.capsule_id.slice(0, 10)}...{cap.capsule_id.slice(-8)} &bull; Threshold: {cap.approval_threshold}-of-{cap.approvers?.length || 3}
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#171A10] border border-[#3A402C] text-[#E6D98D]">
                      {cap.access_mode}
                    </span>
                    <Link
                      href={`/app/capsules/${cap.capsule_id}`}
                      className="px-2.5 py-1 rounded bg-[#303624] hover:bg-[#3A402C] text-xs font-medium text-[#F3F0E4]"
                    >
                      Inspect
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Guardian Telemetry Sidebar (1 Col) */}
        <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4">
          <div className="flex items-center justify-between border-b border-[#2D3321] pb-3">
            <h2 className="text-sm font-bold text-[#F3F0E4] uppercase tracking-wider flex items-center gap-1.5">
              <Server className="w-4 h-4 text-[#858C50]" /> Guardian Network
            </h2>
            <span className="text-[10px] font-mono text-[#858C50]">Active</span>
          </div>

          <div className="space-y-3 text-xs">
            {guardianStatus?.nodes?.map((node: any) => (
              <div key={node.id} className="p-3 rounded bg-[#252A1B] border border-[#3A402C] space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-[#F3F0E4]">{node.name}</span>
                  <span className="px-1.5 py-0.5 rounded bg-emerald-950/40 text-emerald-400 border border-emerald-900/40 text-[9px]">
                    Online
                  </span>
                </div>
                <div className="font-mono text-[10px] text-[#A9A58D] truncate">
                  Key: {node.publicKey}
                </div>
                <div className="text-[10px] text-[#A9A58D]">
                  Port: {node.port} &bull; SQLite Share Store
                </div>
              </div>
            )) || (
              <div className="text-xs text-[#A9A58D]">Loading guardian nodes...</div>
            )}
          </div>

          <div className="p-3 rounded bg-[#252A1B]/50 border border-[#2D3321] text-[11px] text-[#A9A58D] leading-relaxed">
            <strong className="text-[#E6D98D]">Quorum Policy:</strong> Any 2 of 3 independent guardian signatures are required to reconstruct the Data Encryption Key.
          </div>
        </div>
      </div>
    </div>
  );
}
