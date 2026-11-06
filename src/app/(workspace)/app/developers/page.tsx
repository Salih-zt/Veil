'use client';

import React from 'react';
import { Code2, Terminal, Shield, ExternalLink, Copy } from 'lucide-react';

export default function DevelopersPage() {
  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C]">
        <h1 className="text-sm font-bold text-[#F3F0E4] uppercase tracking-wider flex items-center gap-2">
          <Code2 className="w-4 h-4 text-[#858C50]" /> Developer Documentation & TypeScript SDK
        </h1>
        <p className="text-xs text-[#A9A58D] mt-1">
          Integrate programmable secret capsules into decentralized applications and security workflows.
        </p>
      </div>

      {/* Installation */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4">
        <h2 className="text-xs font-bold text-[#F3F0E4] uppercase tracking-wider">
          Package Installation
        </h2>
        <div className="p-3 rounded bg-[#12150D] font-mono text-xs text-[#E6D98D] border border-[#2D3321]">
          npm install @veil-protocol/sdk @noble/ciphers viem
        </div>
      </div>

      {/* Code Snippet: Initialize Client */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4">
        <h2 className="text-xs font-bold text-[#F3F0E4] uppercase tracking-wider">
          1. Initialize the VeilClient
        </h2>
        <div className="p-4 rounded bg-[#12150D] font-mono text-xs text-[#F3F0E4] overflow-x-auto border border-[#2D3321]">
          <pre>{`import { VeilClient } from '@veil-protocol/sdk'
import { HttpGuardianAdapter } from '@veil-protocol/sdk/adapters/guardian'

const client = new VeilClient({
  rpcUrl: 'http://127.0.0.1:8545',
  registryAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  guardians: [
    new HttpGuardianAdapter('http://127.0.0.1:8791', 'guardian-alpha'),
    new HttpGuardianAdapter('http://127.0.0.1:8792', 'guardian-beta'),
    new HttpGuardianAdapter('http://127.0.0.1:8793', 'guardian-gamma'),
  ],
})`}</pre>
        </div>
      </div>

      {/* Code Snippet: Encrypt Capsule */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4">
        <h2 className="text-xs font-bold text-[#F3F0E4] uppercase tracking-wider">
          2. Client-Side AES-256-SIV AEAD Capsule Encryption
        </h2>
        <div className="p-4 rounded bg-[#12150D] font-mono text-xs text-[#F3F0E4] overflow-x-auto border border-[#2D3321]">
          <pre>{`// Encrypts content and splits the 64-byte DEK into 3 Shamir shares over GF(256)
const capsule = await client.capsules.create({
  content: 'CONFIDENTIAL ZERO-DAY ADVISORY PATCH COMMITS',
  policy: {
    unlockTimestamp: Math.floor(Date.now() / 1000) + 3600, // 1 hour timelock
    reviewers: ['0xCharlie...', '0xDavid...', '0xEve...'],
    requiredApprovals: 2,
    recipients: ['0xBob...'],
  },
})

console.log('Capsule ID:', capsule.descriptor.capsuleId)
console.log('Carrier Text:', capsule.carrierText)`}</pre>
        </div>
      </div>

      {/* Code Snippet: Decrypt */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4">
        <h2 className="text-xs font-bold text-[#F3F0E4] uppercase tracking-wider">
          3. Multi-Party Condition Verification & Local Decryption
        </h2>
        <div className="p-4 rounded bg-[#12150D] font-mono text-xs text-[#F3F0E4] overflow-x-auto border border-[#2D3321]">
          <pre>{`// Once unlock time passes and 2 of 3 reviewers approve:
const plaintext = await client.capsules.open({
  carrierText: capsule.carrierText,
  wallet: bobWalletSigner,
})

console.log('Decrypted Secret:', plaintext)`}</pre>
        </div>
      </div>
    </div>
  );
}
