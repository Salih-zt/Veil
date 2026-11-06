'use client';

import React from 'react';
import Link from 'next/link';
import { Lock, Clock, Users, Shield, Zap, Key, ArrowRight } from 'lucide-react';

export default function HowItWorksPage() {
  const steps = [
    {
      num: '01',
      title: 'Encrypt Locally in Browser',
      desc: 'The sender types or uploads secret information. The browser generates a random 64-byte Data Encryption Key (DEK), encrypts content using AES-256-SIV AEAD, and splits the key into Shamir shares over GF(256). The plaintext never touches any network or server.',
      icon: Lock,
    },
    {
      num: '02',
      title: 'Define Disclosure Governance',
      desc: 'The creator sets an unlock delay (e.g. 90 seconds, 1 hour), an expiry timestamp, and designates authorized reviewers. An approval threshold M-of-N is chosen (e.g. 2-of-3). The policy hash is committed to the VeilPolicyRegistry smart contract onchain.',
      icon: Clock,
    },
    {
      num: '03',
      title: 'Distribute Sealed Shares to Guardians',
      desc: 'Each Shamir key share is sealed using an ephemeral X25519 Diffie-Hellman box directed to an independent guardian public key. Independent guardians store the sealed shares in isolated databases without ever seeing raw key material.',
      icon: Zap,
    },
    {
      num: '04',
      title: 'Multi-Party Approvals & Humanity Proof',
      desc: 'Designated reviewers evaluate release criteria and submit cryptographic approval signatures. The recipient verifies their humanity via World ID 4.0 Groth16 zero-knowledge proof, binding the release to their specific wallet address.',
      icon: Users,
    },
    {
      num: '05',
      title: 'Local In-Memory Reconstruction',
      desc: 'Once the unlock timestamp passes and reviewer quorum is satisfied onchain, guardians release the sealed shares. The recipient unseals the shares using their ephemeral private key, interpolates the polynomial to restore the DEK, and decrypts the plaintext in memory.',
      icon: Key,
    },
  ];

  return (
    <div className="py-16 px-6 max-w-4xl mx-auto space-y-12">
      <div>
        <span className="text-xs font-mono text-[#858C50] uppercase tracking-wider">Step-by-Step Architecture</span>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#F3F0E4] mt-2 mb-4">
          How VEIL Enforces Conditional Disclosure
        </h1>
        <p className="text-sm text-[#A9A58D] leading-relaxed">
          From browser-based client encryption to independent guardian thresholds and local DEK reconstruction, every step is mathematically and cryptographically verified.
        </p>
      </div>

      <div className="space-y-6">
        {steps.map((s, idx) => (
          <div key={idx} className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] flex gap-6 items-start">
            <div className="w-12 h-12 rounded-lg bg-[#252A1B] text-[#E6D98D] border border-[#3A402C] font-mono text-sm font-bold flex items-center justify-center shrink-0">
              {s.num}
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-bold text-[#F3F0E4] flex items-center gap-2">
                <s.icon className="w-4 h-4 text-[#E6D98D]" /> {s.title}
              </h3>
              <p className="text-xs text-[#A9A58D] leading-relaxed">{s.desc}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="p-8 rounded-lg bg-[#252A1B] border border-[#3A402C] text-center space-y-4">
        <h3 className="text-xl font-bold text-[#F3F0E4]">Ready to try it yourself?</h3>
        <p className="text-xs text-[#A9A58D]">
          Experience real client-side encryption and collaborative multi-party approval in action.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-8 py-3 rounded bg-[#E6D98D] text-[#12150D] font-bold text-sm hover:bg-[#F3F0E4] transition-all shadow-md"
        >
          <Lock className="w-4 h-4" /> Start Encrypting
        </Link>
      </div>
    </div>
  );
}
