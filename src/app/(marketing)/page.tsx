'use client';

import React from 'react';
import Link from 'next/link';
import {
  Lock,
  Shield,
  Key,
  Users,
  Clock,
  FileCheck,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  Code,
  Terminal,
  Zap,
} from 'lucide-react';

export default function LandingPage() {
  return (
    <div className="flex flex-col gap-24 py-16 px-6 max-w-7xl mx-auto">
      {/* Hero Section */}
      <section className="text-center flex flex-col items-center gap-8 pt-8">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-[#252A1B] border border-[#3A402C] text-xs font-medium text-[#E6D98D]">
          <span className="w-2 h-2 rounded-full bg-[#858C50] animate-pulse" />
          Enterprise Conditional-Disclosure Protocol
        </div>

        <h1 className="text-4xl sm:text-6xl font-bold tracking-tight text-[#F3F0E4] max-w-4xl leading-[1.15]">
          Your secrets. <span className="text-[#E6D98D]">Your conditions.</span> <br />Your control.
        </h1>

        <p className="text-base sm:text-lg text-[#A9A58D] max-w-2xl leading-relaxed">
          Encryption protects information from being read. VEIL goes further — controlling when, why, and by whom encrypted information can be disclosed.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 pt-2">
          <Link
            href="/login"
            className="px-8 py-3.5 rounded bg-[#E6D98D] text-[#12150D] font-bold text-sm hover:bg-[#F3F0E4] transition-all shadow-lg flex items-center gap-2"
          >
            <Lock className="w-4 h-4" /> Start Encrypting
          </Link>
          <Link
            href="/protocol"
            className="px-8 py-3.5 rounded bg-[#252A1B] text-[#F3F0E4] border border-[#3A402C] font-semibold text-sm hover:bg-[#303624] transition-all flex items-center gap-2"
          >
            Explore the Protocol <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        {/* Sophisticated Product Visual Diagram */}
        <div className="w-full max-w-5xl mt-12 p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#2D3321] pb-4 mb-6 text-xs text-[#A9A58D]">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-[#858C50]/40 border border-[#858C50]" />
              <span className="font-mono text-[#E6D98D]">VEIL_LIFECYCLE_SIMULATOR</span>
            </div>
            <div className="font-mono text-[11px] text-[#A9A58D]">
              PROTOCOL STATUS: FAIL-CLOSED &bull; AES-256-SIV &bull; 2-OF-3 QUORUM
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-6 gap-3 text-left">
            {/* Stage 1 */}
            <div className="p-4 rounded bg-[#252A1B] border border-[#3A402C]">
              <div className="text-[10px] font-mono text-[#858C50] uppercase mb-1">Step 01</div>
              <div className="text-xs font-bold text-[#F3F0E4] mb-2 flex items-center gap-1.5">
                <Lock className="w-3.5 h-3.5 text-[#E6D98D]" /> Client Encrypt
              </div>
              <p className="text-[11px] text-[#A9A58D] leading-normal">
                Plaintext locked in browser via AES-256-SIV. DEK split into 3 Shamir shares.
              </p>
            </div>

            {/* Stage 2 */}
            <div className="p-4 rounded bg-[#252A1B] border border-[#3A402C]">
              <div className="text-[10px] font-mono text-[#858C50] uppercase mb-1">Step 02</div>
              <div className="text-xs font-bold text-[#F3F0E4] mb-2 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-[#E6D98D]" /> Policy Commit
              </div>
              <p className="text-[11px] text-[#A9A58D] leading-normal">
                Policy hash committed onchain. Timelocks & approval threshold bound to smart contract.
              </p>
            </div>

            {/* Stage 3 */}
            <div className="p-4 rounded bg-[#252A1B] border border-[#3A402C]">
              <div className="text-[10px] font-mono text-[#858C50] uppercase mb-1">Step 03</div>
              <div className="text-xs font-bold text-[#F3F0E4] mb-2 flex items-center gap-1.5">
                <Users className="w-3.5 h-3.5 text-[#E6D98D]" /> Reviewer Votes
              </div>
              <p className="text-[11px] text-[#A9A58D] leading-normal">
                Authorized reviewers sign onchain or offchain approvals. Quorum (M-of-N) verified.
              </p>
            </div>

            {/* Stage 4 */}
            <div className="p-4 rounded bg-[#252A1B] border border-[#3A402C]">
              <div className="text-[10px] font-mono text-[#858C50] uppercase mb-1">Step 04</div>
              <div className="text-xs font-bold text-[#F3F0E4] mb-2 flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-[#E6D98D]" /> Identity Auth
              </div>
              <p className="text-[11px] text-[#A9A58D] leading-normal">
                Recipient proves humanity via World ID 4.0 and wallet ownership via SIWE.
              </p>
            </div>

            {/* Stage 5 */}
            <div className="p-4 rounded bg-[#252A1B] border border-[#3A402C]">
              <div className="text-[10px] font-mono text-[#858C50] uppercase mb-1">Step 05</div>
              <div className="text-xs font-bold text-[#F3F0E4] mb-2 flex items-center gap-1.5">
                <Zap className="w-3.5 h-3.5 text-[#E6D98D]" /> Guardian Release
              </div>
              <p className="text-[11px] text-[#A9A58D] leading-normal">
                Independent guardians verify policy and deliver sealed key shares to recipient.
              </p>
            </div>

            {/* Stage 6 */}
            <div className="p-4 rounded bg-[#252A1B] border border-[#858C50] bg-[#858C50]/10">
              <div className="text-[10px] font-mono text-[#E6D98D] uppercase mb-1">Step 06</div>
              <div className="text-xs font-bold text-[#E6D98D] mb-2 flex items-center gap-1.5">
                <Key className="w-3.5 h-3.5 text-[#E6D98D]" /> Local Reveal
              </div>
              <p className="text-[11px] text-[#A9A58D] leading-normal">
                DEK reconstructed locally in memory. Plaintext revealed; disclosure receipt generated.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* The Problem: Alice & Bob Scenario */}
      <section className="bg-[#1D2115] border border-[#3A402C] rounded-lg p-8 sm:p-12">
        <div className="max-w-3xl">
          <span className="text-xs font-mono text-[#858C50] uppercase tracking-wider">The Real-World Dilemma</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F3F0E4] mt-2 mb-4">
            Encryption protects the data. But who controls its release?
          </h2>
          <p className="text-sm text-[#A9A58D] leading-relaxed mb-6">
            Consider Alice, a cybersecurity researcher who discovers a critical vulnerability in Northstar Payments.
            She wants Bob, the security lead, to access the remediation details — but <span className="text-[#E6D98D]">only after three conditions are satisfied</span>:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
            <div className="p-4 rounded bg-[#252A1B] border border-[#3A402C]">
              <Clock className="w-4 h-4 text-[#E6D98D] mb-2" />
              <div className="text-xs font-semibold text-[#F3F0E4]">Timelock Delay</div>
              <div className="text-[11px] text-[#A9A58D] mt-1">
                90-second mitigation window before disclosure can occur.
              </div>
            </div>

            <div className="p-4 rounded bg-[#252A1B] border border-[#3A402C]">
              <Users className="w-4 h-4 text-[#E6D98D] mb-2" />
              <div className="text-xs font-semibold text-[#F3F0E4]">Reviewer Quorum</div>
              <div className="text-[11px] text-[#A9A58D] mt-1">
                At least 2 of 3 designated reviewers (Charlie, David, Eve) must sign approval.
              </div>
            </div>

            <div className="p-4 rounded bg-[#252A1B] border border-[#3A402C]">
              <Shield className="w-4 h-4 text-[#E6D98D] mb-2" />
              <div className="text-xs font-semibold text-[#F3F0E4]">Recipient Verification</div>
              <div className="text-[11px] text-[#A9A58D] mt-1">
                Bob must prove humanity via World ID and sign from authorized wallet.
              </div>
            </div>
          </div>

          <p className="text-xs text-[#A9A58D] leading-relaxed">
            With traditional PGP or symmetric encryption, Alice must either send the key immediately (surrendering timing control) or wait manually (introducing operational risk). VEIL eliminates this trade-off using programmable smart contracts and cryptographic guardians.
          </p>
        </div>
      </section>

      {/* Traditional Encryption vs VEIL Comparison Table */}
      <section>
        <div className="text-center mb-8">
          <span className="text-xs font-mono text-[#858C50] uppercase tracking-wider">Architectural Comparison</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F3F0E4] mt-1">
            Traditional Encryption vs. VEIL Protocol
          </h2>
        </div>

        <div className="overflow-x-auto rounded-lg border border-[#3A402C]">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#252A1B] text-[#A9A58D] uppercase font-mono border-b border-[#3A402C]">
              <tr>
                <th className="py-4 px-6">Capability</th>
                <th className="py-4 px-6">Traditional Encryption</th>
                <th className="py-4 px-6 text-[#E6D98D]">VEIL Programmable Protocol</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D3321] bg-[#1D2115] text-[#F3F0E4]">
              <tr>
                <td className="py-4 px-6 font-semibold">Disclosure Governance</td>
                <td className="py-4 px-6 text-[#A9A58D]">Encrypt and share raw key / ciphertext</td>
                <td className="py-4 px-6 text-[#E6D98D] font-medium">Encrypt and bind to onchain policy state</td>
              </tr>
              <tr>
                <td className="py-4 px-6 font-semibold">Access Control</td>
                <td className="py-4 px-6 text-[#A9A58D]">Key possession grants unilateral access</td>
                <td className="py-4 px-6 text-[#E6D98D] font-medium">Policy conditions govern key release</td>
              </tr>
              <tr>
                <td className="py-4 px-6 font-semibold">Reviewer Quorum</td>
                <td className="py-4 px-6 text-[#A9A58D]">No built-in multi-party approval</td>
                <td className="py-4 px-6 text-[#E6D98D] font-medium">Configurable M-of-N threshold quorum</td>
              </tr>
              <tr>
                <td className="py-4 px-6 font-semibold">Key Custody</td>
                <td className="py-4 px-6 text-[#A9A58D]">Single centralized server or sender</td>
                <td className="py-4 px-6 text-[#E6D98D] font-medium">Threshold-based independent guardian cluster</td>
              </tr>
              <tr>
                <td className="py-4 px-6 font-semibold">Auditability</td>
                <td className="py-4 px-6 text-[#A9A58D]">No native disclosure tracking</td>
                <td className="py-4 px-6 text-[#E6D98D] font-medium">Cryptographic disclosure receipts & onchain log</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      {/* 5-Step Workflow */}
      <section className="flex flex-col gap-8">
        <div>
          <span className="text-xs font-mono text-[#858C50] uppercase tracking-wider">How It Works</span>
          <h2 className="text-2xl sm:text-3xl font-bold text-[#F3F0E4] mt-1">
            Five Stages of Controlled Disclosure
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
          <div className="p-5 rounded bg-[#1D2115] border border-[#3A402C]">
            <div className="w-8 h-8 rounded bg-[#252A1B] text-[#E6D98D] font-mono text-xs font-bold flex items-center justify-center mb-4">
              01
            </div>
            <h3 className="text-sm font-bold text-[#F3F0E4] mb-2">Encrypt</h3>
            <p className="text-xs text-[#A9A58D] leading-relaxed">
              Client-side AES-256-SIV AEAD encryption generates a 64-byte DEK and splits it via Shamir Secret Sharing over GF(256).
            </p>
          </div>

          <div className="p-5 rounded bg-[#1D2115] border border-[#3A402C]">
            <div className="w-8 h-8 rounded bg-[#252A1B] text-[#E6D98D] font-mono text-xs font-bold flex items-center justify-center mb-4">
              02
            </div>
            <h3 className="text-sm font-bold text-[#F3F0E4] mb-2">Define Policy</h3>
            <p className="text-xs text-[#A9A58D] leading-relaxed">
              Configure unlock timestamps, expiry deadlines, reviewer lists, and required M-of-N threshold quorums on smart contract.
            </p>
          </div>

          <div className="p-5 rounded bg-[#1D2115] border border-[#3A402C]">
            <div className="w-8 h-8 rounded bg-[#252A1B] text-[#E6D98D] font-mono text-xs font-bold flex items-center justify-center mb-4">
              03
            </div>
            <h3 className="text-sm font-bold text-[#F3F0E4] mb-2">Distribute</h3>
            <p className="text-xs text-[#A9A58D] leading-relaxed">
              Key shares are sealed in X25519 boxes for guardians. Ciphertext is encoded into natural English cover text.
            </p>
          </div>

          <div className="p-5 rounded bg-[#1D2115] border border-[#3A402C]">
            <div className="w-8 h-8 rounded bg-[#252A1B] text-[#E6D98D] font-mono text-xs font-bold flex items-center justify-center mb-4">
              04
            </div>
            <h3 className="text-sm font-bold text-[#F3F0E4] mb-2">Authorize</h3>
            <p className="text-xs text-[#A9A58D] leading-relaxed">
              Reviewers sign approvals. Recipient verifies wallet and World ID proof. Guardians verify conditions are met.
            </p>
          </div>

          <div className="p-5 rounded bg-[#1D2115] border border-[#3A402C]">
            <div className="w-8 h-8 rounded bg-[#252A1B] text-[#E6D98D] font-mono text-xs font-bold flex items-center justify-center mb-4">
              05
            </div>
            <h3 className="text-sm font-bold text-[#F3F0E4] mb-2">Disclose</h3>
            <p className="text-xs text-[#A9A58D] leading-relaxed">
              Guardians return sealed shares. Client unseals and interpolates the DEK locally in browser memory.
            </p>
          </div>
        </div>
      </section>

      {/* Developer SDK Snippet */}
      <section className="bg-[#1D2115] border border-[#3A402C] rounded-lg p-8">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 mb-6">
          <div>
            <span className="text-xs font-mono text-[#858C50] uppercase tracking-wider">Developer SDK</span>
            <h2 className="text-2xl font-bold text-[#F3F0E4] mt-1">Integrate VEIL into Any Web3 Application</h2>
          </div>
          <Link
            href="/app/developers"
            className="px-4 py-2 rounded bg-[#252A1B] border border-[#3A402C] text-xs font-semibold text-[#E6D98D] hover:bg-[#303624] flex items-center gap-1.5"
          >
            <Code className="w-4 h-4" /> View Full SDK Specs
          </Link>
        </div>

        <div className="p-4 rounded bg-[#12150D] border border-[#2D3321] font-mono text-xs text-[#A9A58D] overflow-x-auto">
          <pre className="text-[#F3F0E4]">
{`import { VeilClient } from '@veil-protocol/sdk'

// 1. Initialize client with onchain registry and guardian cluster
const veil = new VeilClient({
  rpcUrl: 'http://127.0.0.1:8545',
  registryAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  guardians: ['http://127.0.0.1:8791', 'http://127.0.0.1:8792', 'http://127.0.0.1:8793']
})

// 2. Encrypt capsule client-side with 2-of-3 reviewer policy
const capsule = await veil.capsules.create({
  content: 'CONFIDENTIAL ZERO-DAY HOTFIX HASH: 0x8a4b6c...',
  policy: {
    unlockTimestamp: Math.floor(Date.now() / 1000) + 3600, // 1 hour timelock
    reviewers: ['0xCharlie...', '0xDavid...', '0xEve...'],
    requiredApprovals: 2,
    recipients: ['0xBob...']
  }
})`}
          </pre>
        </div>
      </section>

      {/* Final Call to Action */}
      <section className="text-center py-12 flex flex-col items-center gap-6 bg-[#252A1B] border border-[#3A402C] rounded-lg p-8">
        <h2 className="text-3xl font-bold text-[#F3F0E4]">Control the conditions. Not just the encryption.</h2>
        <p className="text-sm text-[#A9A58D] max-w-xl">
          Join the future of verifiable, collaborative cryptographic disclosure. Built for ETHGlobal Mumbai.
        </p>
        <Link
          href="/login"
          className="px-8 py-3.5 rounded bg-[#E6D98D] text-[#12150D] font-bold text-sm hover:bg-[#F3F0E4] transition-all shadow-md flex items-center gap-2"
        >
          <Lock className="w-4 h-4" /> Start Encrypting Now
        </Link>
      </section>
    </div>
  );
}
