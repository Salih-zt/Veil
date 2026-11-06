'use client';

import React from 'react';
import Link from 'next/link';
import { Shield, Lock, Cpu, Database, CheckCircle, ArrowRight } from 'lucide-react';

export default function ProtocolPage() {
  return (
    <div className="py-16 px-6 max-w-5xl mx-auto space-y-16">
      <div>
        <span className="text-xs font-mono text-[#858C50] uppercase tracking-wider">Formal Architecture</span>
        <h1 className="text-3xl sm:text-4xl font-bold text-[#F3F0E4] mt-2 mb-4">
          VEIL Protocol Technical Specification
        </h1>
        <p className="text-sm text-[#A9A58D] leading-relaxed">
          VEIL is a verifiable, conditional disclosure layer combining deterministic AEAD cryptography, Galois field secret sharing, independent guardian clusters, and EVM smart contracts.
        </p>
      </div>

      {/* Layer 1: Cryptographic Engine */}
      <div className="p-8 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#858C50] text-[#12150D] flex items-center justify-center font-bold text-xs">
            01
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#F3F0E4]">Deterministic AEAD (AES-256-SIV)</h2>
            <div className="text-xs text-[#A9A58D]">RFC 5297 Authenticated Encryption with Associated Data</div>
          </div>
        </div>

        <p className="text-xs text-[#A9A58D] leading-relaxed">
          Capsule contents are encrypted client-side using AES-256-SIV. Unlike AES-GCM, AES-SIV is deterministic and nonce misuse-resistant. Crucially, the onchain <code className="text-[#E6D98D]">policyHash</code>, <code className="text-[#E6D98D]">capsuleId</code>, and <code className="text-[#E6D98D]">ciphertextHash</code> are bound into the Associated Authenticated Data (AAD). If an adversary tampers with policy parameters onchain, tag verification fails and ciphertext decryption aborts.
        </p>
      </div>

      {/* Layer 2: Shamir Secret Sharing */}
      <div className="p-8 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#858C50] text-[#12150D] flex items-center justify-center font-bold text-xs">
            02
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#F3F0E4]">Shamir's Secret Sharing over GF(256)</h2>
            <div className="text-xs text-[#A9A58D]">Information-Theoretic Key Splitting</div>
          </div>
        </div>

        <p className="text-xs text-[#A9A58D] leading-relaxed">
          The 64-byte Data Encryption Key (DEK) is split into $N$ polynomial shares over the Galois Field $GF(256)$ with an irreducible polynomial $x^8 + x^4 + x^3 + x + 1$ (0x11B). Any subset of $M$ valid shares can reconstruct the DEK via Lagrange polynomial interpolation. Having $M-1$ shares provides strictly zero information regarding the key.
        </p>
      </div>

      {/* Layer 3: Onchain Governance */}
      <div className="p-8 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#858C50] text-[#12150D] flex items-center justify-center font-bold text-xs">
            03
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#F3F0E4]">Smart Contract Policy Commitment</h2>
            <div className="text-xs text-[#A9A58D]">Solidity 0.8.28 &bull; VeilPolicyRegistry.sol</div>
          </div>
        </div>

        <p className="text-xs text-[#A9A58D] leading-relaxed">
          Capsule policies are registered immutably on the Ethereum blockchain. Reviewers cast signed approvals directly onchain or via verified EIP-712 / EIP-191 signatures. The contract strictly evaluates timelocks and threshold quorums via <code className="text-[#E6D98D]">isReleaseReady(capsuleId)</code>, ensuring deterministic verification by external guardian nodes.
        </p>
      </div>

      {/* Layer 4: Steganography */}
      <div className="p-8 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-6">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded bg-[#858C50] text-[#12150D] flex items-center justify-center font-bold text-xs">
            04
          </div>
          <div>
            <h2 className="text-lg font-bold text-[#F3F0E4]">Reversible Steganographic Carrier Text</h2>
            <div className="text-xs text-[#A9A58D]">256-Word Natural English Dictionary Codec</div>
          </div>
        </div>

        <p className="text-xs text-[#A9A58D] leading-relaxed">
          Binary capsule descriptors are reversibly mapped to 64-word English paragraphs using a curated 256-word dictionary. The encoding is 100% byte-exact and reversible without data loss, allowing encrypted capsules to be transmitted across restricted channels as ordinary prose.
        </p>
      </div>

      <div className="text-center pt-8">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 px-8 py-3.5 rounded bg-[#E6D98D] text-[#12150D] font-bold text-sm hover:bg-[#F3F0E4] transition-all shadow-md"
        >
          <Lock className="w-4 h-4" /> Start Encrypting on VEIL
        </Link>
      </div>
    </div>
  );
}
