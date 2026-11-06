'use client';

import React from 'react';
import Link from 'next/link';
import { useAuth } from '@/app/providers';
import { Shield, Lock, Cpu, ArrowRight, ExternalLink } from 'lucide-react';

export default function MarketingLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user } = useAuth();

  return (
    <div className="min-h-screen flex flex-col bg-[#171A10] text-[#F3F0E4]">
      {/* Top Banner Notice */}
      <div className="bg-[#252A1B] border-b border-[#3A402C] px-4 py-2 text-center text-xs text-[#A9A58D]">
        <span className="font-semibold text-[#E6D98D]">VEIL Protocol v2.0</span> — Unified Browser-Native Conditional Disclosure Platform &bull; ETHGlobal Mumbai
      </div>

      {/* Navigation */}
      <header className="sticky top-0 z-50 bg-[#1D2115]/90 backdrop-blur-md border-b border-[#3A402C]">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-8 h-8 rounded bg-[#858C50] flex items-center justify-center font-bold text-[#12150D] shadow-md group-hover:bg-[#B2B77A] transition-colors">
              <Shield className="w-4 h-4 text-[#12150D]" />
            </div>
            <div>
              <span className="font-bold tracking-widest text-[#E6D98D] text-lg">VEIL</span>
              <span className="block text-[9px] uppercase tracking-wider text-[#A9A58D]">Programmable Capsules</span>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-[#A9A58D]">
            <Link href="/protocol" className="hover:text-[#E6D98D] transition-colors">Protocol</Link>
            <Link href="/how-it-works" className="hover:text-[#E6D98D] transition-colors">How It Works</Link>
            <Link href="/use-cases" className="hover:text-[#E6D98D] transition-colors">Use Cases</Link>
            <Link href="/app/developers" className="hover:text-[#E6D98D] transition-colors">Developers</Link>
            <a
              href="https://github.com/Salih-zt/Veil"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-[#E6D98D] transition-colors flex items-center gap-1"
            >
              GitHub <ExternalLink className="w-3 h-3" />
            </a>
          </nav>

          <div className="flex items-center gap-4">
            {user ? (
              <Link
                href="/app"
                className="px-4 py-2 rounded bg-[#858C50] text-[#12150D] text-sm font-semibold hover:bg-[#B2B77A] transition-all flex items-center gap-2"
              >
                Go to Workspace <ArrowRight className="w-4 h-4" />
              </Link>
            ) : (
              <Link
                href="/login"
                className="px-4 py-2 rounded bg-[#E6D98D] text-[#12150D] text-sm font-semibold hover:bg-[#F3F0E4] transition-all shadow-md flex items-center gap-2"
              >
                <Lock className="w-4 h-4" /> Start Encrypting
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">{children}</main>

      {/* Footer */}
      <footer className="bg-[#12150D] border-t border-[#3A402C] py-14 px-6">
        <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-10">
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-6 h-6 rounded bg-[#858C50] flex items-center justify-center font-bold text-[#12150D] text-xs">
                V
              </div>
              <span className="font-bold tracking-widest text-[#E6D98D]">VEIL PROTOCOL</span>
            </div>
            <p className="text-xs text-[#A9A58D] leading-relaxed">
              Programmable secret capsules with client-side AEAD encryption, dynamic threshold secret sharing, independent guardians, and verifiable onchain policy governance.
            </p>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#F3F0E4] mb-3">Protocol</h4>
            <ul className="space-y-2 text-xs text-[#A9A58D]">
              <li><Link href="/protocol" className="hover:text-[#E6D98D]">Technical Specification</Link></li>
              <li><Link href="/how-it-works" className="hover:text-[#E6D98D]">Conditional Lifecycle</Link></li>
              <li><Link href="/use-cases" className="hover:text-[#E6D98D]">Security & Legal Cases</Link></li>
              <li><Link href="/app/guardians" className="hover:text-[#E6D98D]">Guardian Network</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#F3F0E4] mb-3">Developers</h4>
            <ul className="space-y-2 text-xs text-[#A9A58D]">
              <li><Link href="/app/developers" className="hover:text-[#E6D98D]">VEIL TypeScript SDK</Link></li>
              <li><Link href="/app/decoder" className="hover:text-[#E6D98D]">Reversible Stego Codec</Link></li>
              <li><a href="https://github.com/Salih-zt/Veil" className="hover:text-[#E6D98D]">Smart Contracts (Foundry)</a></li>
              <li><a href="https://github.com/Salih-zt/Veil/blob/main/SECURITY_MODEL.md" className="hover:text-[#E6D98D]">Security Model</a></li>
            </ul>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wider text-[#F3F0E4] mb-3">Compliance & Proofs</h4>
            <ul className="space-y-2 text-xs text-[#A9A58D]">
              <li><span className="text-[#858C50]">✓ World ID 4.0 Groth16 Verified</span></li>
              <li><span className="text-[#858C50]">✓ Bidirectional ENS Resolution</span></li>
              <li><span className="text-[#858C50]">✓ AES-256-SIV Deterministic AEAD</span></li>
              <li><span className="text-[#858C50]">✓ Shamir Polynomials over GF(256)</span></li>
            </ul>
          </div>
        </div>

        <div className="max-w-7xl mx-auto mt-12 pt-6 border-t border-[#2D3321] flex flex-col sm:flex-row justify-between items-center text-xs text-[#A9A58D] gap-4">
          <div>&copy; 2026 VEIL Protocol Research. Open-source under MIT License.</div>
          <div className="font-mono text-[11px] text-[#858C50]">
            SHA-256 Verified Build &bull; Fail-Closed Security
          </div>
        </div>
      </footer>
    </div>
  );
}
