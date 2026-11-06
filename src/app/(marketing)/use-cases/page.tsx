'use client';

import React from 'react';
import Link from 'next/link';
import { ShieldAlert, Scale, FileText, FlaskConical, Building, Lock } from 'lucide-react';

export default function UseCasesPage() {
  const useCases = [
    {
      title: 'Responsible Vulnerability Disclosure',
      category: 'Cybersecurity',
      icon: ShieldAlert,
      problem: 'Researchers sharing zero-day exploits risk premature leaks before vendors can deploy patches.',
      solution: 'VEIL creates a timelocked capsule with designated security team reviewers. The exploit details decrypt only after the patch window or upon emergency quorum approval.',
    },
    {
      title: 'Mergers & Confidential Legal Escrow',
      category: 'Legal & Compliance',
      icon: Scale,
      problem: 'M&A contracts, asset deeds, and non-disclosure terms require multi-counsel authorization before execution.',
      solution: 'Independent attorneys from buyer, seller, and escrow firm act as designated reviewers (e.g. 2-of-3 threshold). Documents remain encrypted until multi-party agreement.',
    },
    {
      title: 'Blind Research Submissions',
      category: 'Academic & Science',
      icon: FlaskConical,
      problem: 'Double-blind peer reviews suffer from plagiarism accusations or biased early leaks.',
      solution: 'Research manuscripts are timelocked until the official conference announcement block. Cryptographic disclosure receipts prove submission integrity.',
    },
    {
      title: 'Decentralized Dead Man Switches',
      category: 'Organizational Continuity',
      icon: Building,
      problem: 'Key organizational credentials or disaster recovery plans must disclose if leadership becomes unavailable.',
      solution: 'Automatic release triggered if periodic heartbeat check-ins fail, backed by trusted guardian nodes.',
    },
  ];

  return (
    <div className="py-16 px-6 max-w-5xl mx-auto space-y-12">
      <div>
        <span className="text-xs font-mono text-[#858C50] uppercase tracking-wider">Enterprise Applications</span>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#F3F0E4] mt-2 mb-4">
          VEIL Protocol Use Cases
        </h1>
        <p className="text-sm text-[#A9A58D] leading-relaxed">
          Programmable disclosure replaces manual trust and fragile PGP key exchanges with mathematically guaranteed governance.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {useCases.map((uc, idx) => (
          <div key={idx} className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4">
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded bg-[#252A1B] text-[#E6D98D] border border-[#3A402C]">
                {uc.category}
              </span>
              <uc.icon className="w-5 h-5 text-[#858C50]" />
            </div>

            <h3 className="text-base font-bold text-[#F3F0E4]">{uc.title}</h3>

            <div className="space-y-2 text-xs text-[#A9A58D]">
              <p><strong className="text-[#F3F0E4]">Problem:</strong> {uc.problem}</p>
              <p><strong className="text-[#E6D98D]">VEIL Solution:</strong> {uc.solution}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="text-center pt-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded bg-[#E6D98D] text-[#12150D] font-bold text-sm hover:bg-[#F3F0E4] transition-all shadow-md"
        >
          <Lock className="w-4 h-4" /> Start Encrypting Today
        </Link>
      </div>
    </div>
  );
}
