'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { Layers, ArrowRight, Shield } from 'lucide-react';

export default function CreateRoomPage() {
  const router = useRouter();
  const { token } = useAuth();
  const [name, setName] = useState('Northstar Payments Security Working Group');
  const [description, setDescription] = useState('Private collaboration room for coordinated vulnerability advisory CVE-2026-99214.');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/rooms', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ name, description }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Room creation failed');

      router.push(`/app/rooms/${data.room.id}`);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C]">
        <h1 className="text-sm font-bold text-[#F3F0E4] uppercase tracking-wider flex items-center gap-2">
          <Layers className="w-4 h-4 text-[#858C50]" /> Create Private Room
        </h1>
        <p className="text-xs text-[#A9A58D] mt-1">
          Set up a secured collaboration room with role-based member invitations.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4">
        <div>
          <label className="block text-xs font-semibold text-[#A9A58D] uppercase tracking-wider mb-2">
            Room Name
          </label>
          <input
            type="text"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-[#12150D] border border-[#3A402C] rounded p-3 text-xs text-[#F3F0E4] outline-none focus:border-[#858C50]"
          />
        </div>

        <div>
          <label className="block text-xs font-semibold text-[#A9A58D] uppercase tracking-wider mb-2">
            Description
          </label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full bg-[#12150D] border border-[#3A402C] rounded p-3 text-xs text-[#F3F0E4] outline-none focus:border-[#858C50]"
          />
        </div>

        <div className="flex justify-end pt-4">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 rounded bg-[#858C50] hover:bg-[#B2B77A] text-[#12150D] font-bold text-xs flex items-center gap-2 transition-all shadow-md disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Initialize Room'} <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </form>
    </div>
  );
}
