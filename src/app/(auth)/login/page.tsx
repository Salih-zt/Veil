'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/app/providers';
import { Shield, Lock, Wallet, Users, ArrowRight, CheckCircle2 } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const { user, connectWallet, switchAccount } = useAuth();
  const [loading, setLoading] = useState(false);

  const handleConnect = async () => {
    setLoading(true);
    try {
      await connectWallet();
      router.push('/app');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleQuickSwitch = async (account: 'alice' | 'bob' | 'charlie' | 'david' | 'eve') => {
    setLoading(true);
    try {
      await switchAccount(account);
      router.push('/app');
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#171A10] flex flex-col justify-center items-center px-6 py-12">
      <div className="w-full max-w-md p-8 rounded-lg bg-[#1D2115] border border-[#3A402C] shadow-2xl space-y-8">
        <div className="text-center space-y-2">
          <Link href="/" className="inline-flex items-center gap-2 mb-2">
            <div className="w-8 h-8 rounded bg-[#858C50] flex items-center justify-center font-bold text-[#12150D]">
              <Shield className="w-4 h-4 text-[#12150D]" />
            </div>
            <span className="font-bold tracking-widest text-[#E6D98D] text-lg">VEIL</span>
          </Link>
          <h1 className="text-xl font-bold text-[#F3F0E4]">Sign In with Ethereum</h1>
          <p className="text-xs text-[#A9A58D]">
            Authenticate using your Web3 wallet via cryptographic EIP-191 personal signature challenge.
          </p>
        </div>

        {/* Primary Action */}
        <div className="space-y-4">
          <button
            onClick={handleConnect}
            disabled={loading}
            className="w-full py-3.5 px-4 rounded bg-[#E6D98D] text-[#12150D] font-bold text-sm hover:bg-[#F3F0E4] transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50"
          >
            <Wallet className="w-4 h-4" />
            {loading ? 'Authenticating...' : 'Connect MetaMask / Web3 Wallet'}
          </button>
        </div>

        {/* Quick Testing Switcher */}
        <div className="pt-6 border-t border-[#2D3321] space-y-3">
          <div className="flex items-center justify-between text-xs text-[#A9A58D]">
            <span className="font-semibold text-[#F3F0E4] flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-[#858C50]" /> Judge & Developer Fast-Switch
            </span>
            <span className="font-mono text-[10px] text-[#858C50]">Local Anvil Node</span>
          </div>

          <p className="text-[11px] text-[#A9A58D] leading-normal">
            For demonstration and multi-participant testing without manual MetaMask account toggling:
          </p>

          <div className="grid grid-cols-1 gap-2 pt-1">
            <button
              onClick={() => handleQuickSwitch('alice')}
              className="p-2.5 rounded bg-[#252A1B] hover:bg-[#303624] border border-[#3A402C] text-left text-xs transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-[#E6D98D]">Alice (Creator / Security Researcher)</div>
                <div className="font-mono text-[10px] text-[#A9A58D]">0xf39F...2266 &bull; alice.veil.eth</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#A9A58D]" />
            </button>

            <button
              onClick={() => handleQuickSwitch('bob')}
              className="p-2.5 rounded bg-[#252A1B] hover:bg-[#303624] border border-[#3A402C] text-left text-xs transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-[#E6D98D]">Bob (Recipient / Security Lead)</div>
                <div className="font-mono text-[10px] text-[#A9A58D]">0x7099...79C8 &bull; bob.veil.eth</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#A9A58D]" />
            </button>

            <button
              onClick={() => handleQuickSwitch('charlie')}
              className="p-2.5 rounded bg-[#252A1B] hover:bg-[#303624] border border-[#3A402C] text-left text-xs transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-[#F3F0E4]">Charlie (Reviewer #1)</div>
                <div className="font-mono text-[10px] text-[#A9A58D]">0x3C44...93BC &bull; charlie.veil.eth</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#A9A58D]" />
            </button>

            <button
              onClick={() => handleQuickSwitch('david')}
              className="p-2.5 rounded bg-[#252A1B] hover:bg-[#303624] border border-[#3A402C] text-left text-xs transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-[#F3F0E4]">David (Reviewer #2)</div>
                <div className="font-mono text-[10px] text-[#A9A58D]">0x90F7...b906 &bull; david.veil.eth</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#A9A58D]" />
            </button>

            <button
              onClick={() => handleQuickSwitch('eve')}
              className="p-2.5 rounded bg-[#252A1B] hover:bg-[#303624] border border-[#3A402C] text-left text-xs transition-colors flex items-center justify-between"
            >
              <div>
                <div className="font-semibold text-[#F3F0E4]">Eve (Reviewer #3)</div>
                <div className="font-mono text-[10px] text-[#A9A58D]">0x15d3...6A65 &bull; eve.veil.eth</div>
              </div>
              <ArrowRight className="w-3.5 h-3.5 text-[#A9A58D]" />
            </button>
          </div>
        </div>

        <div className="text-center text-[11px] text-[#A9A58D]">
          By connecting your wallet, you sign a domain-separated SIWE message. No gas fees or private keys required.
        </div>
      </div>
    </div>
  );
}
