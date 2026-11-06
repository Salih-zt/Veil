import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { startGuardianServer } from '../../packages/guardian/server.mjs'
import { formatReleaseMessage, privateKeyToAccount } from '../../packages/guardian/guardian.mjs'
import { createCapsule, openCapsule } from '../../packages/crypto/capsule.mjs'
import { genKeyPair, toHex } from '../../packages/crypto/keys.mjs'
import { openBox, CTX } from '../../packages/crypto/gatebox.mjs'

describe('VEIL Guardian HTTP Microservices End-to-End', () => {
  const bobAccount = privateKeyToAccount(
    '0x59c6995e998f97a5a0044966f0945389dc9e86dae88c7a8412f4603b6b78690d'
  )
  const bobAddress = bobAccount.address.toLowerCase()

  it('runs HTTP servers, processes deposits, releases shares, and decrypts locally', async () => {
    // 1. Start two independent HTTP guardian servers on local ports 8791 and 8792
    const srvA = startGuardianServer({
      port: 8791,
      guardianId: 'guardian-http-a',
      dbPath: ':memory:',
    })
    const srvB = startGuardianServer({
      port: 8792,
      guardianId: 'guardian-http-b',
      dbPath: ':memory:',
    })

    await srvA.listen()
    await srvB.listen()

    try {
      // 2. Query /health for each guardian
      const healthA = await fetch('http://localhost:8791/health').then((r) => r.json())
      const healthB = await fetch('http://localhost:8792/health').then((r) => r.json())

      assert.equal(healthA.ok, true)
      assert.equal(healthA.guardianId, 'guardian-http-a')
      assert.equal(healthB.ok, true)
      assert.equal(healthB.guardianId, 'guardian-http-b')

      const pubKeyA = healthA.pubKey
      const pubKeyB = healthB.pubKey

      // 3. Alice creates a capsule sealing shares for Guardian A and B
      const secret = 'HTTP Microservice Secret Announcement'
      const policyHash = '0x1122334455667788990011223344556677889900112233445566778899001122'
      const capsule = await createCapsule({
        plaintext: secret,
        policyHash,
        threshold: 2,
        totalShares: 2,
        guardianPublicKeys: [pubKeyA, pubKeyB],
      })

      // 4. POST /deposit to Guardian A
      const depResA = await fetch('http://localhost:8791/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capsuleId: capsule.capsuleId,
          shareIndex: 1,
          sealedBox: capsule.shares[0].sealedBox,
          policyHash: capsule.policyHash,
          ciphertextHash: capsule.ciphertextHash,
        }),
      }).then((r) => r.json())

      assert.equal(depResA.ok, true)
      assert.equal(depResA.shareIndex, 1)

      // 5. POST /deposit to Guardian B
      const depResB = await fetch('http://localhost:8792/deposit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          capsuleId: capsule.capsuleId,
          shareIndex: 2,
          sealedBox: capsule.shares[1].sealedBox,
          policyHash: capsule.policyHash,
          ciphertextHash: capsule.ciphertextHash,
        }),
      }).then((r) => r.json())

      assert.equal(depResB.ok, true)
      assert.equal(depResB.shareIndex, 2)

      // 6. Bob generates ephemeral keypair and signs release requests
      const bobEph = genKeyPair()
      const bobEphPubHex = toHex(bobEph.pub)

      // Request Share A
      const nonceA = 'http-nonce-a-1'
      const expiryA = Date.now() + 60000
      const msgA = formatReleaseMessage({
        capsuleId: capsule.capsuleId,
        recipient: bobAddress,
        recipientPub: bobEphPubHex,
        nonce: nonceA,
        expiry: expiryA,
      })
      const sigA = await bobAccount.signMessage({ message: msgA })

      const relResA = await fetch(`http://localhost:8791/capsules/${capsule.capsuleId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: bobAddress,
          recipientPub: bobEphPubHex,
          nonce: nonceA,
          expiry: expiryA,
          signature: sigA,
        }),
      }).then((r) => r.json())

      assert.equal(relResA.ok, true)
      assert.equal(relResA.shareIndex, 1)

      // Request Share B
      const nonceB = 'http-nonce-b-1'
      const expiryB = Date.now() + 60000
      const msgB = formatReleaseMessage({
        capsuleId: capsule.capsuleId,
        recipient: bobAddress,
        recipientPub: bobEphPubHex,
        nonce: nonceB,
        expiry: expiryB,
      })
      const sigB = await bobAccount.signMessage({ message: msgB })

      const relResB = await fetch(`http://localhost:8792/capsules/${capsule.capsuleId}/release`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: bobAddress,
          recipientPub: bobEphPubHex,
          nonce: nonceB,
          expiry: expiryB,
          signature: sigB,
        }),
      }).then((r) => r.json())

      assert.equal(relResB.ok, true)
      assert.equal(relResB.shareIndex, 2)

      // 7. Bob decrypts sealed shares locally using ephemeral private key
      const rawShare1 = openBox(bobEph.priv, bobEph.pub, relResA.sealedShare, CTX.release)
      const rawShare2 = openBox(bobEph.priv, bobEph.pub, relResB.sealedShare, CTX.release)

      assert.ok(rawShare1, 'Share 1 unsealed from Guardian A')
      assert.ok(rawShare2, 'Share 2 unsealed from Guardian B')

      // 8. Bob opens capsule
      const decrypted = openCapsule({
        descriptor: capsule.descriptor,
        shares: [
          { index: 1, share: rawShare1 },
          { index: 2, share: rawShare2 },
        ],
      })

      assert.equal(new TextDecoder().decode(decrypted), secret)
    } finally {
      await srvA.close()
      await srvB.close()
    }
  })
})
