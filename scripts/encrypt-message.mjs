#!/usr/bin/env node
// VEIL Protocol — Plaintext to Steganographic Carrier Text Interactive Demo
// Demonstrates how any secret message is encrypted, sealed, and transformed into natural English prose.

import { createCapsule, openCapsule, parseDescriptor } from '../packages/crypto/capsule.mjs'
import { encodeToCarrierText, decodeFromCarrierText } from '../packages/crypto/codec/wordmap.mjs'
import { genKeyPair, toHex, fromHex } from '../packages/crypto/keys.mjs'

const BOLD = '\x1b[1m'
const RESET = '\x1b[0m'
const GREEN = '\x1b[32m'
const CYAN = '\x1b[36m'
const YELLOW = '\x1b[33m'
const MAGENTA = '\x1b[35m'

// Input message from command line argument or default example
const inputSecret = process.argv.slice(2).join(' ') || 'CONFIDENTIAL: Northstar database master credentials (user: admin, pass: SuperSecret2026!)'

console.log(`\n${BOLD}${CYAN}========================================================================${RESET}`)
console.log(`${BOLD}${CYAN}  VEIL PROTOCOL — PLAINTEXT TO NATURAL ENGLISH STEGANOGRAPHY DEMO${RESET}`)
console.log(`${BOLD}${CYAN}========================================================================${RESET}\n`)

console.log(`${BOLD}1. ORIGINAL CONFIDENTIAL SECRET:${RESET}`)
console.log(`   "${GREEN}${inputSecret}${RESET}"\n`)

// Step 1: Simulate 3 Guardian Keypairs
const g1 = genKeyPair()
const g2 = genKeyPair()
const g3 = genKeyPair()
const guardianPublicKeys = [toHex(g1.pub), toHex(g2.pub), toHex(g3.pub)]

// Step 2: Encrypt secret and create capsule with (2, 3) Shamir Secret Sharing
console.log(`${BOLD}2. ENCRYPTING PAYLOAD & SPLITTING KEY SHARES:${RESET}`)
const payloadBytes = new TextEncoder().encode(inputSecret)
const policyHash = crypto.getRandomValues(new Uint8Array(32))
const capsuleId = crypto.getRandomValues(new Uint8Array(32))

const capsule = await createCapsule({
  plaintext: payloadBytes,
  policyHash,
  capsuleId,
  guardianPublicKeys,
  threshold: 2,
})

console.log(`   • Capsule ID:     ${YELLOW}0x${capsule.capsuleId}${RESET}`)
console.log(`   • Policy Hash:    ${YELLOW}0x${capsule.policyHash}${RESET}`)
console.log(`   • Ciphertext Hash:${YELLOW}0x${capsule.ciphertextHash}${RESET}`)
console.log(`   • Ciphertext Size:${capsule.ciphertext.length} bytes (AES-256-SIV AEAD)`)
console.log(`   • Shamir Shares:  3 shares generated over GF(256), threshold = 2\n`)

// Step 3: Binary Descriptor
const binaryDescriptor = capsule.descriptor
console.log(`${BOLD}3. BINARY DESCRIPTOR (Raw Bytes):${RESET}`)
console.log(`   ${binaryDescriptor.length} total binary bytes\n`)

// Step 4: Reversible Steganographic Encoding into English Carrier Text
const carrierText = encodeToCarrierText(binaryDescriptor)
console.log(`${BOLD}4. INNOCUOUS ENGLISH CARRIER TEXT (256-Word Bijective Codec):${RESET}`)
console.log(`${MAGENTA}"${carrierText}"${RESET}\n`)
console.log(`   ${BOLD}Word Count:${RESET} ${carrierText.split(' ').length} natural English words`)
console.log(`   ${BOLD}Appearance:${RESET} Looks like ordinary casual text/chatter; bypasses DLP filters and scanners!\n`)

// Step 5: Reverse & Decode Carrier Text Back to Binary
console.log(`${BOLD}5. REVERSING CARRIER TEXT (DECODING):${RESET}`)
const recoveredBinary = decodeFromCarrierText(carrierText)
const isExactMatch = recoveredBinary.length === binaryDescriptor.length &&
  recoveredBinary.every((val, idx) => val === binaryDescriptor[idx])
console.log(`   • Binary Reversibility: ${isExactMatch ? GREEN + '100% BYTE-FOR-BYTE IDENTICAL' + RESET : 'MISMATCH'}`)

// Step 6: Decrypt with Threshold Key Shares
// Reconstruct shares 0 and 1 (2-of-3 threshold)
const share1 = capsule.shares[0]
const share2 = capsule.shares[1]

const decryptedBytes = openCapsule({
  descriptor: recoveredBinary,
  shares: [share1, share2],
})
const decryptedText = new TextDecoder().decode(decryptedBytes)

console.log(`\n${BOLD}6. DECRYPTED PLAINTEXT (Using 2 of 3 Threshold Shares):${RESET}`)
console.log(`   "${GREEN}${decryptedText}${RESET}"\n`)

if (decryptedText === inputSecret) {
  console.log(`${BOLD}${GREEN}✔ SUCCESS: Secret was encrypted, concealed in plain English, and perfectly decrypted!${RESET}\n`)
}
