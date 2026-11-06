// @ts-nocheck
import { createPublicClient, http, custom } from 'viem';
import { REGISTRY_ABI } from '@packages/crypto/policy-registry.mjs';

export { REGISTRY_ABI };

export const DEFAULT_REGISTRY_ADDRESS =
  (process.env.NEXT_PUBLIC_VEIL_POLICY_REGISTRY_ADDRESS as `0x${string}`) ||
  '0x5FbDB2315678afecb367f032d93F642f64180aa3';

export const getPublicClient = (rpcUrl = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545') => {
  return createPublicClient({
    transport: http(rpcUrl),
  });
};

export const getBrowserClient = () => {
  if (typeof window !== 'undefined' && (window as any).ethereum) {
    return createPublicClient({
      transport: custom((window as any).ethereum),
    });
  }
  return getPublicClient();
};
