'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/app/providers';
import { encryptCapsuleClient } from '@/lib/crypto/client';
import {
  Lock,
  Clock,
  Users,
  Shield,
  Key,
  FileText,
  CheckCircle2,
  AlertCircle,
  Copy,
  ExternalLink,
  ArrowRight,
} from 'lucide-react';

export default function CreateCapsulePage() {
  const router = useRouter();
  const { user, token } = useAuth();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);

  // Form State
  const [title, setTitle] = useState('Critical Zero-Day Advisory (CVE-2026-99214)');
  const [content, setContent] = useState('CONFIDENTIAL COMMIT HASH: 0x8a4b6c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b\nVulnerability: Reentrancy vector in payment batch clearing pipeline.');
  const [accessMode, setAccessMode] = useState<'named' | 'bearer'>('named');
  const [recipientAddress, setRecipientAddress] = useState('0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
  const [unlockDelaySeconds, setUnlockDelaySeconds] = useState(60);
  const [approvalThreshold, setApprovalThreshold] = useState(2);
  const [reviewersText, setReviewersText] = useState(
    '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC\n0x90F79bf6EB2c4f870365E785982E1f101E93b906\n0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65'
  );
  const [requireWorldId, setRequireWorldId] = useState(true);

  // Execution & Output State
  const [isProcessing, setIsProcessing] = useState(false);
  const [createdResult, setCreatedResult] = useState<any>(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedCarrier, setCopiedCarrier] = useState(false);

  const reviewers = reviewersText
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean);

  const handleNextStep = () => {
    if (step === 1 && !content.trim()) {
      alert('Confidential content is required');
      return;
    }
    if (step === 2) {
      if (reviewers.length === 0) {
        alert('At least one reviewer address is required');
        return;
      }
      if (approvalThreshold > reviewers.length) {
        alert(`Approval threshold (${approvalThreshold}) cannot exceed number of reviewers (${reviewers.length})`);
        return;
      }
    }
    setStep((prev) => (prev < 3 ? ((prev + 1) as any) : prev));
  };

  const handleCreateCapsule = async () => {
    setIsProcessing(true);
    setStep(4);

    try {
      // 1. Client-Side Encryption via AES-256-SIV AEAD + Shamir Key Splitting
      const cryptoResult = await encryptCapsuleClient({
        plaintext: content,
        threshold: 2, // 2-of-3 guardian shares
        totalShares: 3,
        guardianPublicKeys: [
          '0xdf958a81c1f2fbff5b529b31b2a988168faddc41cddd898ef8176b24b974044c',
          '0x469907bf98bf27de6549d84d105f1483161a43fca5160a03dc50c599a6d1ce1a',
          '0x9d3aabbe973934389c91bda02574a1486725d74000cf991024a1df9d2083b17a',
        ],
      });

      // 2. Register Policy & Sealed Envelope on API / DB
      const unlockTs = Math.floor(Date.now() / 1000) + unlockDelaySeconds;
      const res = await fetch('/api/capsules', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          capsuleId: cryptoResult.capsuleId,
          title,
          accessMode,
          policyHash: cryptoResult.policyHash,
          ciphertextHash: cryptoResult.ciphertextHash,
          ciphertextPayload: cryptoResult.ciphertext,
          carrierText: cryptoResult.carrierText,
          unlockTimestamp: unlockTs,
          expiryTimestamp: unlockTs + 86400,
          approvalThreshold,
          guardianThreshold: 2,
          recipients: accessMode === 'named' ? [recipientAddress] : [],
          approvers: reviewers,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Registration failed');

      setCreatedResult({
        ...cryptoResult,
        unlockTimestamp: unlockTs,
        shareUrl: `${window.location.origin}/app/decoder?capsule=${cryptoResult.capsuleId}#carrier=${encodeURIComponent(
          cryptoResult.carrierText
        )}`,
      });

      setStep(5);
    } catch (err: any) {
      alert('Creation Error: ' + err.message);
      setStep(3);
    } finally {
      setIsProcessing(false);
    }
  };

  const copyToClipboard = (text: string, type: 'link' | 'carrier') => {
    navigator.clipboard.writeText(text);
    if (type === 'link') {
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    } else {
      setCopiedCarrier(true);
      setTimeout(() => setCopiedCarrier(false), 2000);
    }
  };

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Wizard Progress Header */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#858C50]" />
            <h1 className="text-sm font-bold text-[#F3F0E4] uppercase tracking-wider">
              Create Programmable Capsule
            </h1>
          </div>
          <div className="text-xs font-mono text-[#E6D98D]">Step {step} of 5</div>
        </div>

        <div className="grid grid-cols-5 gap-2 mt-4">
          {['Content', 'Policy', 'Review', 'Encrypting', 'Complete'].map((stName, idx) => (
            <div
              key={stName}
              className={`h-1.5 rounded-full transition-all ${
                idx + 1 <= step ? 'bg-[#E6D98D]' : 'bg-[#252A1B]'
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step 1: Content */}
      {step === 1 && (
        <div className="p-8 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-6">
          <div className="border-b border-[#2D3321] pb-3">
            <h2 className="text-sm font-bold text-[#F3F0E4] uppercase tracking-wider flex items-center gap-2">
              <Lock className="w-4 h-4 text-[#858C50]" /> Step 1: Confidential Payload
            </h2>
            <p className="text-xs text-[#A9A58D] mt-1">
              Encrypted locally in browser memory via AES-256-SIV AEAD before transmission.
            </p>
          </div>

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-[#A9A58D] uppercase tracking-wider mb-2">
                Capsule Title / Subject
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full bg-[#12150D] border border-[#3A402C] rounded p-3 text-xs text-[#F3F0E4] focus:border-[#858C50] outline-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-[#A9A58D] uppercase tracking-wider mb-2">
                Confidential Secret Text
              </label>
              <textarea
                rows={6}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                className="w-full bg-[#12150D] border border-[#3A402C] rounded p-3 font-mono text-xs text-[#E6D98D] focus:border-[#858C50] outline-none"
              />
            </div>

            <div className="p-3 rounded bg-[#252A1B] border border-[#2D3321] flex items-center gap-3 text-xs text-[#A9A58D]">
              <Shield className="w-4 h-4 text-[#858C50] shrink-0" />
              <span>
                Zero-knowledge invariant: plaintext and Data Encryption Key are never stored on the server.
              </span>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <button
              onClick={handleNextStep}
              className="px-6 py-2.5 rounded bg-[#858C50] hover:bg-[#B2B77A] text-[#12150D] font-bold text-xs flex items-center gap-2 transition-all shadow-md"
            >
              Continue to Policy <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 2: Policy */}
      {step === 2 && (
        <div className="p-8 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-6">
          <div className="border-b border-[#2D3321] pb-3">
            <h2 className="text-sm font-bold text-[#F3F0E4] uppercase tracking-wider flex items-center gap-2">
              <Clock className="w-4 h-4 text-[#858C50]" /> Step 2: Disclosure Governance
            </h2>
            <p className="text-xs text-[#A9A58D] mt-1">
              Configure timelock delays, authorized reviewers, and threshold quorums.
            </p>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#A9A58D] uppercase tracking-wider mb-2">
                  Access Mode
                </label>
                <select
                  value={accessMode}
                  onChange={(e: any) => setAccessMode(e.target.value)}
                  className="w-full bg-[#12150D] border border-[#3A402C] rounded p-3 text-xs text-[#F3F0E4] outline-none"
                >
                  <option value="named">Named Recipient Only</option>
                  <option value="bearer">Bearer (Any Verified Participant)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A9A58D] uppercase tracking-wider mb-2">
                  Unlock Timelock Delay
                </label>
                <select
                  value={unlockDelaySeconds}
                  onChange={(e) => setUnlockDelaySeconds(parseInt(e.target.value, 10))}
                  className="w-full bg-[#12150D] border border-[#3A402C] rounded p-3 text-xs text-[#F3F0E4] outline-none"
                >
                  <option value={60}>60 Seconds (Judge Fast-Demo)</option>
                  <option value={90}>90 Seconds (Northstar Scenario)</option>
                  <option value={3600}>1 Hour (Standard)</option>
                  <option value={86400}>24 Hours (Full Disclosure Window)</option>
                </select>
              </div>
            </div>

            {accessMode === 'named' && (
              <div>
                <label className="block text-xs font-semibold text-[#A9A58D] uppercase tracking-wider mb-2">
                  Designated Recipient Wallet Address
                </label>
                <input
                  type="text"
                  value={recipientAddress}
                  onChange={(e) => setRecipientAddress(e.target.value)}
                  placeholder="0x..."
                  className="w-full bg-[#12150D] border border-[#3A402C] rounded p-3 font-mono text-xs text-[#F3F0E4] outline-none"
                />
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-semibold text-[#A9A58D] uppercase tracking-wider">
                  Reviewer Addresses (One per line)
                </label>
                <span className="text-[10px] text-[#858C50] font-mono">{reviewers.length} Reviewers Configured</span>
              </div>
              <textarea
                rows={3}
                value={reviewersText}
                onChange={(e) => setReviewersText(e.target.value)}
                className="w-full bg-[#12150D] border border-[#3A402C] rounded p-3 font-mono text-xs text-[#F3F0E4] outline-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-[#A9A58D] uppercase tracking-wider mb-2">
                  Reviewer Quorum Threshold (M of N)
                </label>
                <input
                  type="number"
                  min={1}
                  max={reviewers.length || 1}
                  value={approvalThreshold}
                  onChange={(e) => setApprovalThreshold(parseInt(e.target.value, 10))}
                  className="w-full bg-[#12150D] border border-[#3A402C] rounded p-3 text-xs text-[#F3F0E4] outline-none"
                />
                <span className="text-[10px] text-[#A9A58D] mt-1 block">
                  Requires {approvalThreshold} of {reviewers.length} reviewer signatures.
                </span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#A9A58D] uppercase tracking-wider mb-2">
                  Guardian Key Threshold
                </label>
                <input
                  type="text"
                  readOnly
                  value="2 of 3 Guardians"
                  className="w-full bg-[#12150D]/50 border border-[#3A402C] rounded p-3 text-xs text-[#A9A58D] cursor-not-allowed"
                />
                <span className="text-[10px] text-[#A9A58D] mt-1 block">
                  Fixed cryptographic SSS threshold over GF(256).
                </span>
              </div>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(1)}
              className="px-4 py-2 rounded bg-[#252A1B] text-[#A9A58D] hover:text-[#F3F0E4] text-xs font-semibold"
            >
              Back
            </button>
            <button
              onClick={handleNextStep}
              className="px-6 py-2.5 rounded bg-[#858C50] hover:bg-[#B2B77A] text-[#12150D] font-bold text-xs flex items-center gap-2 transition-all shadow-md"
            >
              Review Policy <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Review */}
      {step === 3 && (
        <div className="p-8 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-6">
          <div className="border-b border-[#2D3321] pb-3">
            <h2 className="text-sm font-bold text-[#F3F0E4] uppercase tracking-wider flex items-center gap-2">
              <FileText className="w-4 h-4 text-[#858C50]" /> Step 3: Review & Commit
            </h2>
            <p className="text-xs text-[#A9A58D] mt-1">
              Verify cryptographic and policy parameters before local execution.
            </p>
          </div>

          <div className="p-4 rounded bg-[#252A1B] border border-[#3A402C] space-y-3 text-xs">
            <div className="flex justify-between border-b border-[#2D3321] pb-2">
              <span className="text-[#A9A58D]">Title:</span>
              <span className="font-semibold text-[#F3F0E4]">{title}</span>
            </div>
            <div className="flex justify-between border-b border-[#2D3321] pb-2">
              <span className="text-[#A9A58D]">Access Mode:</span>
              <span className="font-mono text-[#E6D98D] uppercase">{accessMode}</span>
            </div>
            {accessMode === 'named' && (
              <div className="flex justify-between border-b border-[#2D3321] pb-2">
                <span className="text-[#A9A58D]">Recipient:</span>
                <span className="font-mono text-[#F3F0E4]">{recipientAddress}</span>
              </div>
            )}
            <div className="flex justify-between border-b border-[#2D3321] pb-2">
              <span className="text-[#A9A58D]">Unlock Delay:</span>
              <span className="text-[#F3F0E4]">{unlockDelaySeconds} Seconds from now</span>
            </div>
            <div className="flex justify-between border-b border-[#2D3321] pb-2">
              <span className="text-[#A9A58D]">Reviewer Threshold:</span>
              <span className="text-[#E6D98D] font-bold">
                {approvalThreshold} of {reviewers.length} Approvals Required
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-[#A9A58D]">Guardian Cluster:</span>
              <span className="text-[#858C50] font-semibold">2 of 3 Independent Nodes</span>
            </div>
          </div>

          <div className="flex justify-between pt-4">
            <button
              onClick={() => setStep(2)}
              className="px-4 py-2 rounded bg-[#252A1B] text-[#A9A58D] hover:text-[#F3F0E4] text-xs font-semibold"
            >
              Back
            </button>
            <button
              onClick={handleCreateCapsule}
              className="px-8 py-3 rounded bg-[#E6D98D] hover:bg-[#F3F0E4] text-[#12150D] font-bold text-xs flex items-center gap-2 transition-all shadow-lg"
            >
              <Lock className="w-4 h-4" /> Encrypt & Register Onchain
            </button>
          </div>
        </div>
      )}

      {/* Step 4: Encrypting (Loading Animation) */}
      {step === 4 && (
        <div className="p-12 rounded-lg bg-[#1D2115] border border-[#3A402C] text-center space-y-6">
          <div className="w-12 h-12 rounded-full border-2 border-[#858C50] border-t-transparent animate-spin mx-auto" />
          <div className="space-y-2">
            <h3 className="text-base font-bold text-[#F3F0E4]">Encrypting & Splitting DEK Locally...</h3>
            <p className="text-xs text-[#A9A58D] max-w-md mx-auto">
              Generating AES-256-SIV AEAD envelope, splitting 64-byte key into Shamir shares over GF(256), and sealing to guardian public keys.
            </p>
          </div>
        </div>
      )}

      {/* Step 5: Complete */}
      {step === 5 && createdResult && (
        <div className="p-8 rounded-lg bg-[#1D2115] border border-[#858C50] space-y-6">
          <div className="flex items-center gap-3 border-b border-[#2D3321] pb-4">
            <div className="w-8 h-8 rounded bg-[#858C50] text-[#12150D] flex items-center justify-center font-bold">
              ✓
            </div>
            <div>
              <h2 className="text-base font-bold text-[#E6D98D]">Capsule Created & Registered</h2>
              <div className="text-xs text-[#A9A58D]">
                Policy committed onchain &bull; Encrypted key shares deposited to guardians
              </div>
            </div>
          </div>

          <div className="space-y-4 text-xs">
            <div>
              <label className="text-[10px] font-mono uppercase text-[#A9A58D] block mb-1">Capsule ID</label>
              <div className="p-2.5 rounded bg-[#12150D] font-mono text-[11px] text-[#F3F0E4] break-all border border-[#2D3321]">
                {createdResult.capsuleId}
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono uppercase text-[#A9A58D] block mb-1">Policy Hash</label>
              <div className="p-2.5 rounded bg-[#12150D] font-mono text-[11px] text-[#E6D98D] break-all border border-[#2D3321]">
                {createdResult.policyHash}
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-mono uppercase text-[#A9A58D]">Direct Shareable Portal URL</label>
                <button
                  onClick={() => copyToClipboard(createdResult.shareUrl, 'link')}
                  className="text-[10px] text-[#E6D98D] flex items-center gap-1 hover:underline"
                >
                  <Copy className="w-3 h-3" /> {copiedLink ? 'Copied!' : 'Copy Link'}
                </button>
              </div>
              <input
                type="text"
                readOnly
                value={createdResult.shareUrl}
                className="w-full bg-[#12150D] font-mono text-[11px] text-[#F3F0E4] p-2.5 rounded border border-[#2D3321]"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-[10px] font-mono uppercase text-[#A9A58D]">
                  Reversible Natural-Language Carrier Text (Stego)
                </label>
                <button
                  onClick={() => copyToClipboard(createdResult.carrierText, 'carrier')}
                  className="text-[10px] text-[#E6D98D] flex items-center gap-1 hover:underline"
                >
                  <Copy className="w-3 h-3" /> {copiedCarrier ? 'Copied!' : 'Copy Carrier Text'}
                </button>
              </div>
              <div className="p-3 rounded bg-[#12150D] font-mono text-[11px] text-[#A9A58D] border border-[#2D3321] max-h-24 overflow-y-auto leading-relaxed">
                {createdResult.carrierText}
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between pt-4 border-t border-[#2D3321]">
            <button
              onClick={() => {
                setStep(1);
                setCreatedResult(null);
              }}
              className="px-4 py-2 rounded bg-[#252A1B] text-[#A9A58D] hover:text-[#F3F0E4] text-xs font-semibold"
            >
              Create Another Capsule
            </button>
            <button
              onClick={() => router.push(`/app/capsules/${createdResult.capsuleId}`)}
              className="px-6 py-2.5 rounded bg-[#858C50] hover:bg-[#B2B77A] text-[#12150D] text-xs font-bold transition-all shadow-md flex items-center gap-2"
            >
              View Capsule Inspector <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
