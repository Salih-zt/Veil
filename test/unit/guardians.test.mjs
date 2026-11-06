import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { createGuardianCore, formatReleaseMessage, privateKeyToAccount } from '../../packages/guardian/guardian.mjs'
import { createCapsule, openCapsule, parseDescriptor } from '../../packages/crypto/capsule.mjs'
import { genKeyPair, toHex } from '../../packages/crypto/keys.mjs'
import { openBox, CTX } from '../../packages/crypto/gatebox.mjs'

describe('VEIL Independent Guardian Cluster (2-of-3 Threshold Delivery)', () => {
  // Test accounts
  const bobAccount = privateKeyToAccount(
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
  )
  const bobAddress = bobAccount.address.toLowerCase()

  it('securely deposits shares to 3 guardians without exposing plaintext at rest', async () => {
    // 1. Initialize 3 independent in-memory guardians
    const ga = createGuardianCore({ guardianId: 'guardian-a' })
    const gb = createGuardianCore({ guardianId: 'guardian-b' })
    const gc = createGuardianCore({ guardianId: 'guardian-c' })

    const secret = 'Confidential Mumbai Winner: Team Alpha'
    const policyHash = '0x1234567890123456789012345678901234567890123456789012345678901234'

    // 2. Alice creates capsule sealing shares to guardian public keys
    const capsule = await createCapsule({
      plaintext: secret,
      policyHash,
      guardianPublicKeys: [ga.pubKey, gb.pubKey, gc.pubKey],
    })

    assert.equal(capsule.shares.length, 3)

    // 3. Deposit shares to respective guardians
    const depA = ga.deposit({
      capsuleId: capsule.capsuleId,
      shareIndex: 1,
      sealedBox: capsule.shares[0].sealedBox,
      policyHash: capsule.policyHash,
      ciphertextHash: capsule.ciphertextHash,
    })
    const depB = gb.deposit({
      capsuleId: capsule.capsuleId,
      shareIndex: 2,
      sealedBox: capsule.shares[1].sealedBox,
      policyHash: capsule.policyHash,
      ciphertextHash: capsule.ciphertextHash,
    })
    const depC = gc.deposit({
      capsuleId: capsule.capsuleId,
      shareIndex: 3,
      sealedBox: capsule.shares[2].sealedBox,
      policyHash: capsule.policyHash,
      ciphertextHash: capsule.ciphertextHash,
    })

    assert.equal(depA.ok, true)
    assert.equal(depB.ok, true)
    assert.equal(depC.ok, true)

    // Duplicate deposit is rejected
    assert.throws(
      () =>
        ga.deposit({
          capsuleId: capsule.capsuleId,
          shareIndex: 1,
          sealedBox: capsule.shares[0].sealedBox,
          policyHash: capsule.policyHash,
          ciphertextHash: capsule.ciphertextHash,
        }),
      /already deposited/
    )

    // Health reports stored shares
    assert.equal(ga.health().sharesStored, 1)
    assert.equal(gb.health().sharesStored, 1)
    assert.equal(gc.health().sharesStored, 1)
  })

  it('denies early release when onchain policy conditions are not met', async () => {
    // Mock onchain registry client that reports NOT ready (e.g. deadline not passed)
    const mockPublicClient = {
      readContract: async ({ functionName }) => {
        if (functionName === 'isReleaseReadyForRecipient') return false
        if (functionName === 'isReleaseReady') return false
        return null
      },
    }

    const ga = createGuardianCore({
      guardianId: 'guardian-a',
      publicClient: mockPublicClient,
      registryAddress: '0x1111111111111111111111111111111111111111',
    })

    const secret = 'Unrevealed secret'
    const policyHash = '0x1234567890123456789012345678901234567890123456789012345678901234'
    const capsule = await createCapsule({
      plaintext: secret,
      policyHash,
      guardianPublicKeys: [ga.pubKey],
    })

    ga.deposit({
      capsuleId: capsule.capsuleId,
      shareIndex: 1,
      sealedBox: capsule.shares[0].sealedBox,
      policyHash: capsule.policyHash,
      ciphertextHash: capsule.ciphertextHash,
    })

    // Bob attempts to request release prematurely
    const bobEph = genKeyPair()
    const nonce = 'test-nonce-1'
    const expiry = Date.now() + 60000

    const message = formatReleaseMessage({
      capsuleId: capsule.capsuleId,
      recipient: bobAddress,
      recipientPub: toHex(bobEph.pub),
      nonce,
      expiry,
    })
    const signature = await bobAccount.signMessage({ message })

    await assert.rejects(
      async () => {
        await ga.release({
          capsuleId: capsule.capsuleId,
          recipient: bobAddress,
          recipientPub: toHex(bobEph.pub),
          nonce,
          expiry,
          signature,
        })
      },
      /onchain policy conditions not satisfied/
    )
  })

  it('rejects forged signatures, expired requests, and replayed nonces', async () => {
    const ga = createGuardianCore({ guardianId: 'guardian-a' })
    const secret = 'Signed request protection'
    const policyHash = '0x1234567890123456789012345678901234567890123456789012345678901234'
    const capsule = await createCapsule({
      plaintext: secret,
      policyHash,
      guardianPublicKeys: [ga.pubKey],
    })

    ga.deposit({
      capsuleId: capsule.capsuleId,
      shareIndex: 1,
      sealedBox: capsule.shares[0].sealedBox,
      policyHash: capsule.policyHash,
      ciphertextHash: capsule.ciphertextHash,
    })

    const bobEph = genKeyPair()
    const nonce = 'test-nonce-replay-1'
    const validExpiry = Date.now() + 60000

    // 1. Forged signature (signed by someone else)
    const attackerAccount = privateKeyToAccount(
      '0x5de4111afa1a4b94908f83103eb1f1706367c2e68ca870fc3fb9a804cdab365a'
    )
    const forgedMessage = formatReleaseMessage({
      capsuleId: capsule.capsuleId,
      recipient: bobAddress, // Claims to be Bob
      recipientPub: toHex(bobEph.pub),
      nonce,
      expiry: validExpiry,
    })
    const forgedSignature = await attackerAccount.signMessage({ message: forgedMessage })

    await assert.rejects(
      async () => {
        await ga.release({
          capsuleId: capsule.capsuleId,
          recipient: bobAddress,
          recipientPub: toHex(bobEph.pub),
          nonce,
          expiry: validExpiry,
          signature: forgedSignature,
        })
      },
      /invalid recipient signature/
    )

    // 2. Expired request
    const expiredTime = Date.now() - 1000
    const expMessage = formatReleaseMessage({
      capsuleId: capsule.capsuleId,
      recipient: bobAddress,
      recipientPub: toHex(bobEph.pub),
      nonce: 'nonce-exp',
      expiry: expiredTime,
    })
    const expSig = await bobAccount.signMessage({ message: expMessage })

    await assert.rejects(
      async () => {
        await ga.release({
          capsuleId: capsule.capsuleId,
          recipient: bobAddress,
          recipientPub: toHex(bobEph.pub),
          nonce: 'nonce-exp',
          expiry: expiredTime,
          signature: expSig,
        })
      },
      /request has expired/
    )

    // 3. Valid release followed by replay attempt with same nonce
    const validMessage = formatReleaseMessage({
      capsuleId: capsule.capsuleId,
      recipient: bobAddress,
      recipientPub: toHex(bobEph.pub),
      nonce,
      expiry: validExpiry,
    })
    const validSig = await bobAccount.signMessage({ message: validMessage })

    // First request succeeds
    const res1 = await ga.release({
      capsuleId: capsule.capsuleId,
      recipient: bobAddress,
      recipientPub: toHex(bobEph.pub),
      nonce,
      expiry: validExpiry,
      signature: validSig,
    })
    assert.equal(res1.ok, true)

    // Replay with exact same nonce fails
    await assert.rejects(
      async () => {
        await ga.release({
          capsuleId: capsule.capsuleId,
          recipient: bobAddress,
          recipientPub: toHex(bobEph.pub),
          nonce, // Replayed nonce
          expiry: validExpiry,
          signature: validSig,
        })
      },
      /nonce has already been used/
    )
  })

  it('full 2-of-3 threshold release: Bob decrypts secret with shares from 2 guardians while 3rd is offline', async () => {
    // Mock onchain registry reporting READY for Bob
    const mockPublicClient = {
      readContract: async ({ functionName }) => {
        if (functionName === 'isReleaseReadyForRecipient') return true
        if (functionName === 'isReleaseReady') return true
        return null
      },
    }

    const ga = createGuardianCore({
      guardianId: 'guardian-a',
      publicClient: mockPublicClient,
      registryAddress: '0x1111111111111111111111111111111111111111',
    })
    const gb = createGuardianCore({
      guardianId: 'guardian-b',
      publicClient: mockPublicClient,
      registryAddress: '0x1111111111111111111111111111111111111111',
    })
    const gc = createGuardianCore({
      guardianId: 'guardian-c',
      publicClient: mockPublicClient,
      registryAddress: '0x1111111111111111111111111111111111111111',
    })

    const secret = 'ETHGlobal Mumbai 2026: Confirmed First Prize Winner!'
    const policyHash = '0x9999999999999999999999999999999999999999999999999999999999999999'

    // Alice creates capsule and deposits shares to all 3 guardians
    const capsule = await createCapsule({
      plaintext: secret,
      policyHash,
      guardianPublicKeys: [ga.pubKey, gb.pubKey, gc.pubKey],
    })

    ga.deposit({
      capsuleId: capsule.capsuleId,
      shareIndex: 1,
      sealedBox: capsule.shares[0].sealedBox,
      policyHash: capsule.policyHash,
      ciphertextHash: capsule.ciphertextHash,
    })
    gb.deposit({
      capsuleId: capsule.capsuleId,
      shareIndex: 2,
      sealedBox: capsule.shares[1].sealedBox,
      policyHash: capsule.policyHash,
      ciphertextHash: capsule.ciphertextHash,
    })
    gc.deposit({
      capsuleId: capsule.capsuleId,
      shareIndex: 3,
      sealedBox: capsule.shares[2].sealedBox,
      policyHash: capsule.policyHash,
      ciphertextHash: capsule.ciphertextHash,
    })

    // Bob generates fresh ephemeral X25519 keypair for receiving shares
    const bobEph = genKeyPair()
    const bobEphPubHex = toHex(bobEph.pub)

    // Bob requests Share 1 from Guardian A
    const nonceA = 'bob-req-ga-1'
    const expiryA = Date.now() + 60000
    const msgA = formatReleaseMessage({
      capsuleId: capsule.capsuleId,
      recipient: bobAddress,
      recipientPub: bobEphPubHex,
      nonce: nonceA,
      expiry: expiryA,
    })
    const sigA = await bobAccount.signMessage({ message: msgA })

    const relA = await ga.release({
      capsuleId: capsule.capsuleId,
      recipient: bobAddress,
      recipientPub: bobEphPubHex,
      nonce: nonceA,
      expiry: expiryA,
      signature: sigA,
    })
    assert.equal(relA.ok, true)
    assert.equal(relA.shareIndex, 1)

    // Bob requests Share 2 from Guardian B
    const nonceB = 'bob-req-gb-1'
    const expiryB = Date.now() + 60000
    const msgB = formatReleaseMessage({
      capsuleId: capsule.capsuleId,
      recipient: bobAddress,
      recipientPub: bobEphPubHex,
      nonce: nonceB,
      expiry: expiryB,
    })
    const sigB = await bobAccount.signMessage({ message: msgB })

    const relB = await gb.release({
      capsuleId: capsule.capsuleId,
      recipient: bobAddress,
      recipientPub: bobEphPubHex,
      nonce: nonceB,
      expiry: expiryB,
      signature: sigB,
    })
    assert.equal(relB.ok, true)
    assert.equal(relB.shareIndex, 2)

    // Note: Guardian C is offline/ignored! Only 2 of 3 shares needed.

    // Bob decrypts sealed shares using his ephemeral private key
    const rawShare1 = openBox(bobEph.priv, bobEph.pub, relA.sealedShare, CTX.release)
    const rawShare2 = openBox(bobEph.priv, bobEph.pub, relB.sealedShare, CTX.release)

    assert.ok(rawShare1, 'Share 1 unsealed')
    assert.ok(rawShare2, 'Share 2 unsealed')

    // Bob decrypts original secret locally
    const decryptedBytes = openCapsule({
      descriptor: capsule.descriptor,
      shares: [
        { index: 1, share: rawShare1 },
        { index: 2, share: rawShare2 },
      ],
    })

    assert.equal(new TextDecoder().decode(decryptedBytes), secret)
  })
})
