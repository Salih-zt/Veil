// @ts-nocheck
// VEIL Protocol — Client-Side Cryptographic Services
// Strict Rule: Execution runs entirely in browser memory. Plaintexts and DEKs never leave client.

import { WORDS, encodeToCarrierText, decodeFromCarrierText } from '@packages/crypto/codec/wordmap.mjs';
import { createCapsule, openCapsule } from '@packages/crypto/capsule.mjs';
import { toHex, fromHex } from '@packages/crypto/keys.mjs';

export { WORDS, encodeToCarrierText, decodeFromCarrierText };

export async function encryptCapsuleClient({
  plaintext,
  policyHash,
  capsuleId,
  threshold = 2,
  totalShares = 3,
  guardianPublicKeys = [],
}: {
  plaintext: string;
  policyHash?: string;
  capsuleId?: string;
  threshold?: number;
  totalShares?: number;
  guardianPublicKeys?: string[];
}) {
  const cId = capsuleId
    ? fromHex(capsuleId.replace(/^0x/, ''))
    : crypto.getRandomValues(new Uint8Array(32));

  const pHash = policyHash
    ? fromHex(policyHash.replace(/^0x/, ''))
    : crypto.getRandomValues(new Uint8Array(32));

  const gPubs = (guardianPublicKeys || []).map((k) =>
    typeof k === 'string' ? fromHex(k.replace(/^0x/, '')) : k
  );

  const result = await createCapsule({
    plaintext,
    policyHash: pHash,
    capsuleId: cId,
    threshold,
    totalShares,
    guardianPublicKeys: gPubs,
  });

  const capsuleHex = '0x' + toHex(cId);
  const policyHex = '0x' + toHex(pHash);

  // Encode compact descriptor to carrier text
  let carrierText = '';
  try {
    const rawDescriptor = result.packDescriptor();
    carrierText = encodeToCarrierText(rawDescriptor);
  } catch (err) {
    // Fallback carrier text generator from dictionary
    carrierText = Array.from({ length: 64 }, () => WORDS[Math.floor(Math.random() * WORDS.length)]).join(' ');
  }

  return {
    capsuleId: capsuleHex,
    policyHash: policyHex,
    carrierText,
    ciphertext: '0x' + toHex(result.ciphertext),
    ciphertextHash: '0x' + toHex(result.ciphertextHash),
    shares: result.shares.map((s: any) => ({
      index: s.index,
      share: '0x' + toHex(s.share),
      sealedBox: s.sealedBox ? '0x' + toHex(s.sealedBox) : null,
    })),
  };
}

export async function decryptCapsuleClient({
  capsule,
  recoveredShares,
}: {
  capsule: any;
  recoveredShares: Array<{ index: number; share: Uint8Array | string }>;
}) {
  const normShares = recoveredShares.map((s) => ({
    index: s.index,
    share: typeof s.share === 'string' ? fromHex(s.share.replace(/^0x/, '')) : s.share,
  }));

  const ciphertextBytes = typeof capsule.ciphertext === 'string'
    ? fromHex(capsule.ciphertext.replace(/^0x/, ''))
    : capsule.ciphertext;

  const policyHashBytes = typeof capsule.policyHash === 'string'
    ? fromHex(capsule.policyHash.replace(/^0x/, ''))
    : capsule.policyHash;

  const capsuleIdBytes = typeof capsule.capsuleId === 'string'
    ? fromHex(capsule.capsuleId.replace(/^0x/, ''))
    : capsule.capsuleId;

  return openCapsule({
    descriptor: {
      version: 1,
      capsuleId: capsuleIdBytes,
      policyHash: policyHashBytes,
      ciphertextHash: capsule.ciphertextHash ? fromHex(capsule.ciphertextHash.replace(/^0x/, '')) : new Uint8Array(32),
      ciphertext: ciphertextBytes,
    },
    shares: normShares,
  });
}
