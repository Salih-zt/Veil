'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import type { User } from '@/types';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  connectWallet: () => Promise<void>;
  switchAccount: (accountName: 'alice' | 'bob' | 'charlie' | 'david' | 'eve') => Promise<void>;
  disconnect: () => void;
  refreshUser: () => Promise<void>;
}

const DEV_ACCOUNTS = {
  alice: {
    name: 'Alice (Creator / Researcher)',
    address: '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266',
    ens: 'alice.veil.eth',
  },
  bob: {
    name: 'Bob (Recipient / Security Lead)',
    address: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8',
    ens: 'bob.veil.eth',
  },
  charlie: {
    name: 'Charlie (Reviewer #1)',
    address: '0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC',
    ens: 'charlie.veil.eth',
  },
  david: {
    name: 'David (Reviewer #2)',
    address: '0x90F79bf6EB2c4f870365E785982E1f101E93b906',
    ens: 'david.veil.eth',
  },
  eve: {
    name: 'Eve (Reviewer #3)',
    address: '0x15d34AAf54267DB7D7c367839AAf71A00a2C6A65',
    ens: 'eve.veil.eth',
  },
};

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedToken = localStorage.getItem('veil_token');
    if (savedToken) {
      setToken(savedToken);
      fetchUser(savedToken);
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async (authToken: string) => {
    try {
      const res = await fetch('/api/auth/me', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
      } else {
        localStorage.removeItem('veil_token');
        setToken(null);
        setUser(null);
      }
    } catch {
      // Offline fallback
    } finally {
      setIsLoading(false);
    }
  };

  const connectWallet = async () => {
    if (typeof window === 'undefined') return;

    try {
      let address = '';
      if ((window as any).ethereum) {
        const accounts = await (window as any).ethereum.request({
          method: 'eth_requestAccounts',
        });
        address = accounts[0];
      } else {
        // Fallback for browser without extension: connect as Alice
        address = DEV_ACCOUNTS.alice.address;
      }

      // 1. Get challenge nonce
      const nonceRes = await (await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address }),
      })).json();

      if (!nonceRes.ok) throw new Error(nonceRes.message);

      const message = `Sign in to VEIL Protocol\nAddress: ${address}\nNonce: ${nonceRes.nonce}\nIssued At: ${nonceRes.issuedAt}`;
      let signature = '';

      if ((window as any).ethereum) {
        signature = await (window as any).ethereum.request({
          method: 'personal_sign',
          params: [message, address],
        });
      } else {
        // Fallback simulated signature for testing without MetaMask
        signature = '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef1b';
      }

      // 2. Verify signature
      const verifyRes = await (await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address, message, signature }),
      })).json();

      if (verifyRes.ok) {
        localStorage.setItem('veil_token', verifyRes.sessionToken);
        setToken(verifyRes.sessionToken);
        setUser(verifyRes.user);
      } else {
        throw new Error(verifyRes.message);
      }
    } catch (err: any) {
      alert('Wallet sign-in failed: ' + err.message);
    }
  };

  const switchAccount = async (accountKey: keyof typeof DEV_ACCOUNTS) => {
    const acc = DEV_ACCOUNTS[accountKey];
    if (!acc) return;

    try {
      const nonceRes = await (await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: acc.address }),
      })).json();

      const message = `Sign in to VEIL Protocol\nAddress: ${acc.address}\nNonce: ${nonceRes.nonce}\nIssued At: ${nonceRes.issuedAt}`;
      // Known dev signature or mock for dev quick-switch
      const dummySig = '0x' + '00'.repeat(65);

      const verifyRes = await (await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ address: acc.address, message, signature: dummySig }),
      })).json();

      if (verifyRes.ok) {
        localStorage.setItem('veil_token', verifyRes.sessionToken);
        setToken(verifyRes.sessionToken);
        setUser(verifyRes.user);
      }
    } catch (err: any) {
      console.error('Account switch failed', err);
    }
  };

  const disconnect = () => {
    localStorage.removeItem('veil_token');
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    if (token) await fetchUser(token);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        connectWallet,
        switchAccount,
        disconnect,
        refreshUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
