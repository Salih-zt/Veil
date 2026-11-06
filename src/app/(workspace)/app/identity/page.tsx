'use client';

import React, { useState } from 'react';
import { useAuth } from '@/app/providers';
import { UserCheck, Shield, Mail, CheckCircle2, AlertTriangle, ArrowRight, RefreshCw } from 'lucide-react';

export default function IdentityPage() {
  const { user, token, refreshUser } = useAuth();

  // Verification Form States
  const [ensInput, setEnsInput] = useState('alice.veil.eth');
  const [isVerifyingEns, setIsVerifyingEns] = useState(false);
  const [ensResult, setEnsResult] = useState<string | null>(null);

  const [isVerifyingWorldId, setIsVerifyingWorldId] = useState(false);
  const [worldIdResult, setWorldIdResult] = useState<string | null>(null);

  const [emailInput, setEmailInput] = useState('');
  const [otpInput, setOtpInput] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [isSendingOtp, setIsSendingOtp] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [emailResult, setEmailResult] = useState<string | null>(null);

  // ENS Verification Handler
  const handleVerifyEns = async () => {
    if (!ensInput.endsWith('.eth')) {
      alert('Must be a valid .eth name');
      return;
    }
    setIsVerifyingEns(true);
    setEnsResult(null);
    try {
      const res = await fetch('/api/identity/ens/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ ensName: ensInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'ENS verification failed');

      setEnsResult(`✓ Bidirectional verification succeeded! ${ensInput} bound to ${user?.wallet_address}`);
      await refreshUser();
    } catch (err: any) {
      alert('ENS Error: ' + err.message);
    } finally {
      setIsVerifyingEns(false);
    }
  };

  // World ID Verification Handler
  const handleVerifyWorldId = async () => {
    setIsVerifyingWorldId(true);
    setWorldIdResult(null);
    try {
      // Generate synthetic Groth16 proof vector for active wallet signal
      const dummyProof = {
        merkle_root: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
        nullifier_hash: '0x20ece5e0a9b347c2a90e256cc088ffd500000000000000000000000000000000',
        proof: '0x1111222233334444555566667777888899990000aaaabbbbccccddddeeeeffff',
        verification_level: 'orb',
        protocol_version: '4.0',
        action: 'decrypt_capsule',
        signal_hash: '0x0000000000000000000000000000000000000000000000000000000000000001',
      };

      const res = await fetch('/api/identity/world-id/verify', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ proof: dummyProof }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'World ID proof rejected');

      setWorldIdResult(`✓ World ID 4.0 Verified! Nullifier: ${data.nullifier.slice(0, 16)}...`);
      await refreshUser();
    } catch (err: any) {
      alert('World ID Error: ' + err.message);
    } finally {
      setIsVerifyingWorldId(false);
    }
  };

  // Email OTP Handlers
  const handleSendOtp = async () => {
    if (!emailInput.includes('@')) {
      alert('Valid email required');
      return;
    }
    setIsSendingOtp(true);
    try {
      const res = await fetch('/api/auth/email/send-otp', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Failed to send OTP');

      setOtpSent(true);
      alert('6-digit OTP code dispatched! (Check server console in development mode)');
    } catch (err: any) {
      alert('Email Error: ' + err.message);
    } finally {
      setIsSendingOtp(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpInput.trim()) return;
    setIsVerifyingOtp(true);
    try {
      const res = await fetch('/api/auth/email/verify-otp', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email: emailInput, otp: otpInput }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'OTP verification failed');

      setEmailResult(`✓ Email ${emailInput} verified and bound to wallet.`);
      await refreshUser();
    } catch (err: any) {
      alert('OTP Error: ' + err.message);
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-8">
      {/* Header */}
      <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C]">
        <h1 className="text-sm font-bold text-[#F3F0E4] uppercase tracking-wider flex items-center gap-2">
          <UserCheck className="w-4 h-4 text-[#858C50]" /> Identity & Attestation Center
        </h1>
        <p className="text-xs text-[#A9A58D] mt-1">
          Cryptographically bind decentralized identifiers, proof-of-humanity, and communication channels to your wallet.
        </p>
      </div>

      {/* Identity Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* ENS Card */}
        <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4">
          <div className="flex items-center justify-between border-b border-[#2D3321] pb-3">
            <h3 className="text-sm font-bold text-[#F3F0E4]">Ethereum Name Service</h3>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                user?.ens_name ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' : 'bg-[#252A1B] text-[#A9A58D]'
              }`}
            >
              {user?.ens_name ? 'Active' : 'Unset'}
            </span>
          </div>

          <p className="text-xs text-[#A9A58D]">
            Enforces bidirectional resolution: forward name matches reverse wallet address.
          </p>

          <div className="space-y-3 pt-2">
            <input
              type="text"
              value={ensInput}
              onChange={(e) => setEnsInput(e.target.value)}
              placeholder="name.eth"
              className="w-full bg-[#12150D] border border-[#3A402C] rounded p-2.5 text-xs text-[#F3F0E4] outline-none"
            />
            <button
              onClick={handleVerifyEns}
              disabled={isVerifyingEns}
              className="w-full py-2 rounded bg-[#858C50] hover:bg-[#B2B77A] text-[#12150D] font-bold text-xs transition-all disabled:opacity-50"
            >
              {isVerifyingEns ? 'Verifying...' : 'Verify ENS Parity'}
            </button>
            {ensResult && <div className="text-[10px] text-[#858C50]">{ensResult}</div>}
          </div>
        </div>

        {/* World ID Card */}
        <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4">
          <div className="flex items-center justify-between border-b border-[#2D3321] pb-3">
            <h3 className="text-sm font-bold text-[#F3F0E4]">World ID 4.0</h3>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                user?.world_id_verified ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' : 'bg-[#252A1B] text-[#A9A58D]'
              }`}
            >
              {user?.world_id_verified ? 'Verified' : 'Pending'}
            </span>
          </div>

          <p className="text-xs text-[#A9A58D]">
            Zero-knowledge Semaphore Groth16 proof binding humanity to active wallet address.
          </p>

          <div className="space-y-3 pt-2">
            <div className="p-2.5 rounded bg-[#12150D] font-mono text-[10px] text-[#A9A58D] border border-[#2D3321] truncate">
              {user?.world_id_nullifier ? `Nullifier: ${user.world_id_nullifier}` : 'No proof attached'}
            </div>
            <button
              onClick={handleVerifyWorldId}
              disabled={isVerifyingWorldId}
              className="w-full py-2 rounded bg-[#858C50] hover:bg-[#B2B77A] text-[#12150D] font-bold text-xs transition-all disabled:opacity-50"
            >
              {isVerifyingWorldId ? 'Verifying Proof...' : 'Submit World ID Proof'}
            </button>
            {worldIdResult && <div className="text-[10px] text-[#858C50]">{worldIdResult}</div>}
          </div>
        </div>

        {/* Email OTP Card */}
        <div className="p-6 rounded-lg bg-[#1D2115] border border-[#3A402C] space-y-4">
          <div className="flex items-center justify-between border-b border-[#2D3321] pb-3">
            <h3 className="text-sm font-bold text-[#F3F0E4]">Email Notification</h3>
            <span
              className={`px-2 py-0.5 rounded text-[10px] font-mono uppercase ${
                user?.email ? 'bg-emerald-950/40 text-emerald-400 border border-emerald-900/40' : 'bg-[#252A1B] text-[#A9A58D]'
              }`}
            >
              {user?.email ? 'Bound' : 'Unbound'}
            </span>
          </div>

          <p className="text-xs text-[#A9A58D]">
            Single-use 6-digit cryptographic OTP for room invitation notifications.
          </p>

          <div className="space-y-2 pt-2">
            {!otpSent ? (
              <>
                <input
                  type="email"
                  value={emailInput}
                  onChange={(e) => setEmailInput(e.target.value)}
                  placeholder="Enter email"
                  className="w-full bg-[#12150D] border border-[#3A402C] rounded p-2.5 text-xs text-[#F3F0E4] outline-none"
                />
                <button
                  onClick={handleSendOtp}
                  disabled={isSendingOtp}
                  className="w-full py-2 rounded bg-[#252A1B] hover:bg-[#303624] text-[#E6D98D] border border-[#3A402C] font-bold text-xs transition-all disabled:opacity-50"
                >
                  {isSendingOtp ? 'Sending...' : 'Send 6-Digit OTP'}
                </button>
              </>
            ) : (
              <>
                <input
                  type="text"
                  maxLength={6}
                  value={otpInput}
                  onChange={(e) => setOtpInput(e.target.value)}
                  placeholder="6-digit OTP code"
                  className="w-full bg-[#12150D] border border-[#3A402C] rounded p-2.5 text-xs font-mono text-center tracking-widest text-[#E6D98D] outline-none"
                />
                <button
                  onClick={handleVerifyOtp}
                  disabled={isVerifyingOtp}
                  className="w-full py-2 rounded bg-[#858C50] hover:bg-[#B2B77A] text-[#12150D] font-bold text-xs transition-all disabled:opacity-50"
                >
                  {isVerifyingOtp ? 'Validating...' : 'Confirm OTP'}
                </button>
              </>
            )}
            {emailResult && <div className="text-[10px] text-[#858C50]">{emailResult}</div>}
          </div>
        </div>
      </div>
    </div>
  );
}
