'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import {
  Shield,
  LayoutDashboard,
  Layers,
  Lock,
  Inbox,
  CheckSquare,
  KeyRound,
  Server,
  UserCheck,
  FileText,
  Code2,
  Settings,
  LogOut,
  ChevronDown,
  ExternalLink,
  Users,
} from 'lucide-react';

export default function WorkspaceLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, disconnect, switchAccount } = useAuth();
  const [showSwitchMenu, setShowSwitchMenu] = useState(false);

  const navItems = [
    { label: 'Overview', href: '/app', icon: LayoutDashboard },
    { label: 'Private Rooms', href: '/app/rooms', icon: Layers },
    { label: 'My Capsules', href: '/app/capsules', icon: Lock },
    { label: 'Received Capsules', href: '/app/received', icon: Inbox },
    { label: 'Reviewer Approvals', href: '/app/approvals', icon: CheckSquare },
    { label: 'Decoder & Reveal', href: '/app/decoder', icon: KeyRound },
    { label: 'Guardian Network', href: '/app/guardians', icon: Server },
    { label: 'Identity & Access', href: '/app/identity', icon: UserCheck },
    { label: 'Disclosure History', href: '/app/history', icon: FileText },
    { label: 'Developer / SDK', href: '/app/developers', icon: Code2 },
    { label: 'Settings', href: '/app/settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen flex bg-[#171A10] text-[#F3F0E4]">
      {/* Sidebar */}
      <aside className="w-64 bg-[#1D2115] border-r border-[#3A402C] flex flex-col shrink-0">
        {/* Header */}
        <div className="p-5 border-b border-[#2D3321] flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded bg-[#858C50] flex items-center justify-center font-bold text-[#12150D] text-xs">
              <Shield className="w-4 h-4 text-[#12150D]" />
            </div>
            <div>
              <span className="font-bold tracking-widest text-[#E6D98D] text-sm">VEIL</span>
              <span className="block text-[8px] uppercase tracking-wider text-[#A9A58D]">Workspace</span>
            </div>
          </Link>
          <span className="px-2 py-0.5 rounded bg-[#252A1B] border border-[#3A402C] text-[9px] font-mono text-[#858C50]">
            Anvil:31337
          </span>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-3 space-y-1 overflow-y-auto text-xs">
          {navItems.map((item) => {
            const active = pathname === item.href;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded transition-all font-medium ${
                  active
                    ? 'bg-[#252A1B] text-[#E6D98D] border-l-2 border-[#858C50] font-semibold'
                    : 'text-[#A9A58D] hover:bg-[#252A1B] hover:text-[#F3F0E4]'
                }`}
              >
                <item.icon className={`w-4 h-4 ${active ? 'text-[#E6D98D]' : 'text-[#A9A58D]'}`} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        {/* User Card & Switcher at Bottom */}
        <div className="p-4 border-t border-[#2D3321] bg-[#12150D]/60 space-y-3">
          <div className="relative">
            <button
              onClick={() => setShowSwitchMenu(!showSwitchMenu)}
              className="w-full p-2 rounded bg-[#252A1B] border border-[#3A402C] hover:bg-[#303624] transition-all flex items-center justify-between text-left"
            >
              <div className="truncate pr-2">
                <div className="text-[11px] font-semibold text-[#E6D98D] truncate">
                  {user?.ens_name || (user?.wallet_address ? `${user.wallet_address.slice(0, 6)}...${user.wallet_address.slice(-4)}` : 'Not Connected')}
                </div>
                <div className="font-mono text-[9px] text-[#A9A58D] truncate">
                  {user?.wallet_address || 'Connect Wallet'}
                </div>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#A9A58D] shrink-0" />
            </button>

            {/* Quick Switch Dropdown */}
            {showSwitchMenu && (
              <div className="absolute bottom-full left-0 w-full mb-2 bg-[#252A1B] border border-[#3A402C] rounded shadow-2xl p-2 z-50 text-[11px] space-y-1">
                <div className="text-[9px] font-mono uppercase text-[#858C50] px-2 py-1">Fast-Switch Role</div>
                {(['alice', 'bob', 'charlie', 'david', 'eve'] as const).map((acc) => (
                  <button
                    key={acc}
                    onClick={() => {
                      switchAccount(acc);
                      setShowSwitchMenu(false);
                    }}
                    className="w-full text-left px-2 py-1.5 rounded hover:bg-[#303624] text-[#F3F0E4] capitalize flex items-center justify-between"
                  >
                    <span>{acc}</span>
                    <span className="text-[9px] font-mono text-[#A9A58D]">{acc}.veil.eth</span>
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={() => {
              disconnect();
              router.push('/login');
            }}
            className="w-full flex items-center justify-center gap-1.5 py-1.5 px-3 rounded bg-red-950/20 hover:bg-red-950/40 border border-red-900/40 text-red-300 text-xs transition-colors"
          >
            <LogOut className="w-3.5 h-3.5" /> Disconnect
          </button>
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-y-auto">
        {/* Topbar */}
        <header className="h-16 bg-[#1D2115]/80 backdrop-blur-md border-b border-[#3A402C] px-8 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-[#A9A58D] uppercase tracking-wider">
              {navItems.find((n) => n.href === pathname)?.label || 'Workspace'}
            </span>
            {user?.world_id_verified && (
              <span className="px-2 py-0.5 rounded bg-[#858C50]/20 text-[#B2B77A] border border-[#858C50] text-[10px] font-semibold uppercase">
                World ID Verified
              </span>
            )}
            {user?.ens_name && (
              <span className="px-2 py-0.5 rounded bg-[#E6D98D]/20 text-[#E6D98D] border border-[#C6B95F] text-[10px] font-mono">
                {user.ens_name}
              </span>
            )}
          </div>

          <div className="flex items-center gap-4">
            <Link
              href="/app/capsules/create"
              className="px-3 py-1.5 rounded bg-[#858C50] hover:bg-[#B2B77A] text-[#12150D] text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5" /> New Capsule
            </Link>
          </div>
        </header>

        {/* Child Pages */}
        <main className="flex-1 p-8">{children}</main>
      </div>
    </div>
  );
}
