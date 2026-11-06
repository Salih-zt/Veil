'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/providers';
import { Layers, Plus, Users, ArrowRight, Shield } from 'lucide-react';

export default function RoomsPage() {
  const { user, token } = useAuth();
  const [rooms, setRooms] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (token) {
      loadRooms();
    }
  }, [token]);

  const loadRooms = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/rooms', {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setRooms(data.rooms || []);
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
            <Layers className="w-4 h-4 text-[#858C50]" /> Private Collaborative Rooms
          </h1>
          <p className="text-xs text-[#A9A58D] mt-1">
            Role-based collaboration spaces for enterprise disclosure and multi-counsel governance.
          </p>
        </div>
        <Link
          href="/app/rooms/create"
          className="px-4 py-2 rounded bg-[#858C50] hover:bg-[#B2B77A] text-[#12150D] text-xs font-bold transition-all shadow-md flex items-center gap-1.5"
        >
          <Plus className="w-3.5 h-3.5" /> Create Room
        </Link>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {rooms.length === 0 ? (
          <div className="col-span-2 p-12 rounded-lg bg-[#1D2115] border border-[#3A402C] text-center space-y-3">
            <Layers className="w-8 h-8 text-[#A9A58D] mx-auto opacity-30" />
            <p className="text-xs text-[#A9A58D]">No private rooms found. Create your first room to invite participants.</p>
          </div>
        ) : (
          rooms.map((room) => (
            <Link
              key={room.id}
              href={`/app/rooms/${room.id}`}
              className="p-5 rounded-lg bg-[#1D2115] border border-[#3A402C] hover:border-[#858C50] transition-colors space-y-3 group block"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#F3F0E4] group-hover:text-[#E6D98D] transition-colors">
                  {room.name}
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-mono uppercase bg-[#252A1B] text-[#858C50] border border-[#3A402C]">
                  {room.status || 'Active'}
                </span>
              </div>
              <p className="text-xs text-[#A9A58D] line-clamp-2">
                {room.description || 'No description provided.'}
              </p>
              <div className="flex items-center justify-between pt-2 border-t border-[#2D3321] text-[10px] font-mono text-[#A9A58D]">
                <span>Owner: {room.owner_address ? `${room.owner_address.slice(0, 6)}...` : 'Me'}</span>
                <span className="flex items-center gap-1 text-[#E6D98D]">
                  Open Room <ArrowRight className="w-3 h-3" />
                </span>
              </div>
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
