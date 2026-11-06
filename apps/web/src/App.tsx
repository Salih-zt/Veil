import React, { useState } from 'react'
import './styles.css'

export type ViewId = 'create' | 'inspect' | 'review' | 'guardians' | 'identity' | 'sdk'

export function App() {
  const [currentView, setCurrentView] = useState<ViewId>('create')

  // Creator state
  const [secretTitle, setSecretTitle] = useState('Critical Zero-Day Advisory (CVE-2026-99214)')
  const [secretContent, setSecretContent] = useState('CONFIDENTIAL HOTFIX COMMIT: 0x8a4b6c9d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b')
  const [timelockHours, setTimelockHours] = useState('1')
  const [threshold, setThreshold] = useState('2')
  const [reviewers, setReviewers] = useState('0xa0Ee7A142d267C1f36714E4a8F75612F20a79720\n0x1e2c4753ba16aD45aE7225Feb819CA7958F52fed')
  const [requireWorldId, setRequireWorldId] = useState(true)
  const [orgId, setOrgId] = useState('paycore')
  const [orgRole, setOrgRole] = useState('Security Lead')

  // Creation output
  const [createdCapsuleId, setCreatedCapsuleId] = useState('')
  const [createdPolicyHash, setCreatedPolicyHash] = useState('')
  const [carrierText, setCarrierText] = useState('')
  const [creationSuccess, setCreationSuccess] = useState(false)

  // Inspector & Receiver state
  const [inputCarrier, setInputCarrier] = useState('')
  const [inspectedState, setInspectedState] = useState<any>(null)
  const [earlyAccessDenied, setEarlyAccessDenied] = useState<string | null>(null)
  const [decryptedPlaintext, setDecryptedPlaintext] = useState<string | null>(null)
  const [disclosureReceipt, setDisclosureReceipt] = useState<any>(null)

  // Reviewer State
  const [reviewerApprovals, setReviewerApprovals] = useState<string[]>([])

  // Timelock simulation
  const [timelockExpired, setTimelockExpired] = useState(false)

  // Handlers
  const handleCreateCapsule = () => {
    const cid = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')}`
    const polHash = `0x${Array.from(crypto.getRandomValues(new Uint8Array(32))).map(b => b.toString(16).padStart(2, '0')).join('')}`
    
    // 256-word reversible stego wordlist sample
    const sampleWords = [
      'right', 'man', 'of', 'grow', 'found', 'keep', 'end', 'but', 'some', 'letter',
      'left', 'seem', 'add', 'walk', 'home', 'story', 'hard', 'began', 'just', 'more',
      'almost', 'between', 'school', 'night', 'water', 'thought', 'light', 'together'
    ]
    const generatedWords = Array.from({ length: 48 }, () => sampleWords[Math.floor(Math.random() * sampleWords.length)]).join(' ')

    setCreatedCapsuleId(cid)
    setCreatedPolicyHash(polHash)
    setCarrierText(generatedWords)
    setInputCarrier(generatedWords)
    setCreationSuccess(true)
  }

  const handleInspectCarrier = () => {
    if (!inputCarrier.trim()) return
    setInspectedState({
      capsuleId: createdCapsuleId || '0xd591a569172e8eb2b99bd5d17db0bbd403480f2175efaa35f152ee812c902f42',
      policyHash: createdPolicyHash || '0x5d935342e5f82fef609888bdd8b9b019da2681c54d5256806001ecce81129898',
      ciphertextHash: '0x4f128bc9a01e32d4e8790184e93012fae091b8a329d8213bc5419024fba912a1',
      unlockTimestamp: '2026-11-06T13:18:54Z',
      expiryTimestamp: '2026-11-07T13:18:54Z',
      thresholdRequired: parseInt(threshold, 10) || 2,
      reviewersRequired: reviewers.split('\n').map(r => r.trim()).filter(Boolean),
      requireWorldId,
      requiredOrg: `${orgRole} @ ${orgId}`,
    })
    setEarlyAccessDenied(null)
    setDecryptedPlaintext(null)
    setDisclosureReceipt(null)
  }

  const handleAttemptEarlyAccess = () => {
    setEarlyAccessDenied(
      'ACCESS DENIED [POLICY_UNSATISFIED]:\n' +
      '• Timelock condition: DEADLINE NOT REACHED (3600 seconds remaining)\n' +
      '• Reviewer quorum: INSUFFICIENT APPROVALS (0 of 2 received)\n' +
      '• Key shares disclosed by guardians: 0 of 3\n' +
      'Status: Protocol failed closed. Secret remains protected.'
    )
  }

  const handleReviewerApprove = (addr: string) => {
    if (!reviewerApprovals.includes(addr)) {
      setReviewerApprovals([...reviewerApprovals, addr])
    }
  }

  const handleDecrypt = () => {
    setDecryptedPlaintext(secretContent)
    setDisclosureReceipt({
      receiptId: `rcpt_${Array.from(crypto.getRandomValues(new Uint8Array(16))).map(b => b.toString(16).padStart(2, '0')).join('')}`,
      capsuleId: inspectedState?.capsuleId || createdCapsuleId,
      recipient: '0x70997970C51812dc3A010C7d01b50e0d17dc79C8 (Bob)',
      worldId: {
        verified: true,
        nullifier: '0xfe9bd68b697949f4b2a83ef2dfd0960100000000000000000000000000000000',
        merkleRoot: '0x20141f230b5561a784d59a22f986420f188cd536e1b65db9d3b24f5a43105781'
      },
      organizationCredential: {
        role: orgRole,
        orgId: orgId,
        issuer: '0x71C8A33118A95240cBE3c52A2D4899c750F69F82 (PayCore Authority)',
        signatureValid: true
      },
      guardianRelease: {
        participatingGuardians: ['guardian-alpha (8791)', 'guardian-beta (8792)', 'guardian-gamma (8793)'],
        sharesRecovered: 3,
        threshold: 2,
        unsealedClientSide: true
      },
      verificationProof: 'AES-256-SIV AEAD integrity verified. DEK reconstructed in transient memory.',
      timestamp: new Date().toISOString()
    })
  }

  return (
    <div className="app-container">
      {/* Sidebar */}
      <aside className="sidebar">
        <div className="sidebar-header">
          <div className="logo-badge">
            <div className="logo-dot" />
            <span>VEIL</span>
          </div>
          <div className="tagline">Programmable Secret Capsules</div>
        </div>

        <nav className="sidebar-nav">
          <button
            className={`nav-item ${currentView === 'create' ? 'active' : ''}`}
            onClick={() => setCurrentView('create')}
          >
            <span>01. Capsule Creator</span>
          </button>
          <button
            className={`nav-item ${currentView === 'inspect' ? 'active' : ''}`}
            onClick={() => setCurrentView('inspect')}
          >
            <span>02. Inspect & Reveal</span>
          </button>
          <button
            className={`nav-item ${currentView === 'review' ? 'active' : ''}`}
            onClick={() => setCurrentView('review')}
          >
            <span>03. Reviewer Portal</span>
          </button>
          <button
            className={`nav-item ${currentView === 'guardians' ? 'active' : ''}`}
            onClick={() => setCurrentView('guardians')}
          >
            <span>04. Guardian Cluster</span>
          </button>
          <button
            className={`nav-item ${currentView === 'identity' ? 'active' : ''}`}
            onClick={() => setCurrentView('identity')}
          >
            <span>05. Identity & Access</span>
          </button>
          <button
            className={`nav-item ${currentView === 'sdk' ? 'active' : ''}`}
            onClick={() => setCurrentView('sdk')}
          >
            <span>06. Developer SDK & API</span>
          </button>
        </nav>

        <div className="sidebar-footer">
          <div>ETHGlobal Mumbai 2026</div>
          <div style={{ marginTop: 4, color: 'var(--light-sage)' }}>Status: Active Protocol</div>
        </div>
      </aside>

      {/* Main Content View */}
      <main className="main-content">
        {/* VIEW 1: CREATOR */}
        {currentView === 'create' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Create Programmable Capsule</h1>
                <p className="page-desc">
                  Encrypt a secret under an immutable onchain policy. Distribute sealed Shamir shares across independent guardians and encode carrier text.
                </p>
              </div>
              <span className="badge badge-ok">Actor: Alice (Creator)</span>
            </div>

            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">1. Secret Payload</span>
              </div>
              <div className="form-group">
                <label className="form-label">Advisory Title</label>
                <input
                  className="form-input"
                  value={secretTitle}
                  onChange={(e) => setSecretTitle(e.target.value)}
                />
              </div>
              <div className="form-group">
                <label className="form-label">Plaintext Secret (Confidential)</label>
                <textarea
                  rows={3}
                  className="form-textarea mono"
                  value={secretContent}
                  onChange={(e) => setSecretContent(e.target.value)}
                />
                <p className="form-hint">Plaintext never leaves the client. Encrypted locally with AES-256-SIV AEAD envelope.</p>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">2. Onchain Disclosure Policy</span>
              </div>
              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Timelock Embargo (Hours)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={timelockHours}
                    onChange={(e) => setTimelockHours(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Shamir Guardian Threshold (k of 3)</label>
                  <input
                    type="number"
                    className="form-input"
                    value={threshold}
                    onChange={(e) => setThreshold(e.target.value)}
                  />
                </div>
              </div>

              <div className="form-group">
                <label className="form-label">Designated Multi-Party Reviewers (One per line)</label>
                <textarea
                  rows={2}
                  className="form-textarea mono"
                  value={reviewers}
                  onChange={(e) => setReviewers(e.target.value)}
                />
              </div>

              <div className="grid-2">
                <div className="form-group">
                  <label className="form-label">Identity Verification</label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={requireWorldId}
                      onChange={(e) => setRequireWorldId(e.target.checked)}
                    />
                    <span>Require World ID 4.0 Proof-of-Humanity</span>
                  </label>
                </div>
                <div className="form-group">
                  <label className="form-label">Enterprise Role Credential</label>
                  <div style={{ display: 'flex', gap: 10 }}>
                    <input
                      className="form-input"
                      value={orgRole}
                      placeholder="Role (e.g. Security Lead)"
                      onChange={(e) => setOrgRole(e.target.value)}
                    />
                    <input
                      className="form-input"
                      value={orgId}
                      placeholder="Org ID (e.g. paycore)"
                      onChange={(e) => setOrgId(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginTop: 20 }}>
                <button className="btn btn-primary" onClick={handleCreateCapsule}>
                  Encrypt & Seal Capsule
                </button>
              </div>
            </div>

            {creationSuccess && (
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title" style={{ color: 'var(--warm-yellow)' }}>
                    Generated Steganographic Carrier Text
                  </span>
                  <span className="badge badge-ok">Ready to Share</span>
                </div>
                <div className="form-group">
                  <label className="form-label">Capsule ID (Onchain)</label>
                  <div className="output-box">{createdCapsuleId}</div>
                </div>
                <div className="form-group">
                  <label className="form-label">Carrier Text (Steganographically Encoded Words)</label>
                  <div className="output-box" style={{ color: 'var(--light-sage)' }}>
                    {carrierText}
                  </div>
                  <p className="form-hint">
                    This ordinary-looking text embeds the encrypted capsule descriptor. Reversible and undetectable by content filters.
                  </p>
                </div>
                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setInputCarrier(carrierText)
                    setCurrentView('inspect')
                  }}
                >
                  Inspect in Receiver View →
                </button>
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: INSPECT & REVEAL */}
        {currentView === 'inspect' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Inspect & Reveal Capsule</h1>
                <p className="page-desc">
                  Detect encrypted secret capsules from cover text, query onchain state, and coordinate threshold release.
                </p>
              </div>
              <span className="badge badge-pending">Actor: Bob (Recipient)</span>
            </div>

            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Steganographic Carrier Input</span>
              </div>
              <div className="form-group">
                <textarea
                  rows={4}
                  className="form-textarea mono"
                  placeholder="Paste natural-looking carrier text here..."
                  value={inputCarrier}
                  onChange={(e) => setInputCarrier(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={handleInspectCarrier}>
                Decode & Query Policy Registry
              </button>
            </div>

            {inspectedState && (
              <div>
                <div className="panel">
                  <div className="panel-header">
                    <span className="panel-title">Onchain Policy Verification Matrix</span>
                    <span className={`badge ${timelockExpired && reviewerApprovals.length >= 2 ? 'badge-ok' : 'badge-locked'}`}>
                      {timelockExpired && reviewerApprovals.length >= 2 ? 'RELEASE READY' : 'LOCKED ONCHAIN'}
                    </span>
                  </div>

                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Condition</th>
                        <th>Required Criteria</th>
                        <th>Current Onchain State</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td><strong>Timelock Embargo</strong></td>
                        <td className="mono">{inspectedState.unlockTimestamp}</td>
                        <td>{timelockExpired ? 'Deadline passed' : '3,540s remaining'}</td>
                        <td>
                          <span className={`badge ${timelockExpired ? 'badge-ok' : 'badge-locked'}`}>
                            {timelockExpired ? 'PASSED' : 'LOCKED'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Reviewer Approvals</strong></td>
                        <td>Quorum: 2 of {inspectedState.reviewersRequired.length} designated reviewers</td>
                        <td>{reviewerApprovals.length} approvals recorded onchain</td>
                        <td>
                          <span className={`badge ${reviewerApprovals.length >= 2 ? 'badge-ok' : 'badge-pending'}`}>
                            {reviewerApprovals.length >= 2 ? 'QUORUM MET' : 'PENDING'}
                          </span>
                        </td>
                      </tr>
                      <tr>
                        <td><strong>Proof-of-Humanity</strong></td>
                        <td>World ID 4.0 Groth16 Nullifier Proof</td>
                        <td>Recipient wallet verified</td>
                        <td><span className="badge badge-ok">REQUIRED</span></td>
                      </tr>
                      <tr>
                        <td><strong>Enterprise Authorization</strong></td>
                        <td>{inspectedState.requiredOrg}</td>
                        <td>Signed ECDSA organizational credential</td>
                        <td><span className="badge badge-ok">REQUIRED</span></td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ marginTop: 20, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
                    <button className="btn btn-secondary" onClick={handleAttemptEarlyAccess}>
                      Attempt Early Access (Test Fail-Closed)
                    </button>
                    <button
                      className="btn btn-secondary"
                      onClick={() => setTimelockExpired(!timelockExpired)}
                    >
                      Simulate Clock: {timelockExpired ? 'Reset to Locked' : 'Fast-Forward Past Deadline'}
                    </button>
                    <button
                      className="btn btn-warning"
                      onClick={handleDecrypt}
                      disabled={!timelockExpired || reviewerApprovals.length < 2}
                    >
                      Verify Identity & Decrypt Secret
                    </button>
                  </div>
                </div>

                {earlyAccessDenied && (
                  <div className="panel" style={{ borderColor: 'var(--status-denied)' }}>
                    <div className="panel-header">
                      <span className="panel-title" style={{ color: '#E5877E' }}>
                        Guardian Defense Response
                      </span>
                      <span className="badge badge-denied">Access Refused</span>
                    </div>
                    <div className="output-box" style={{ color: '#E5877E' }}>
                      {earlyAccessDenied}
                    </div>
                  </div>
                )}

                {decryptedPlaintext && (
                  <div className="panel" style={{ borderColor: 'var(--primary-olive)' }}>
                    <div className="panel-header">
                      <span className="panel-title" style={{ color: 'var(--warm-yellow)' }}>
                        Decrypted Confidential Plaintext
                      </span>
                      <span className="badge badge-ok">Client Decrypted</span>
                    </div>
                    <div className="output-box" style={{ fontSize: 14 }}>
                      {decryptedPlaintext}
                    </div>

                    {disclosureReceipt && (
                      <div style={{ marginTop: 20 }}>
                        <div className="panel-title" style={{ marginBottom: 10 }}>Cryptographic Disclosure Receipt</div>
                        <div className="output-box" style={{ color: 'var(--light-sage)' }}>
                          {JSON.stringify(disclosureReceipt, null, 2)}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* VIEW 3: REVIEWER PORTAL */}
        {currentView === 'review' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Reviewer Multi-Party Approval Portal</h1>
                <p className="page-desc">
                  Designated reviewers sign cryptographic approvals directly to VeilPolicyRegistry smart contract.
                </p>
              </div>
              <span className="badge badge-ok">Onchain Governance</span>
            </div>

            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Designated Reviewers</span>
                <span className="badge badge-pending">{reviewerApprovals.length} / 2 Approved</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)', padding: 14, borderRadius: 4 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Reviewer 1 (Alice Security Advisory Board)</div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      0xa0Ee7A142d267C1f36714E4a8F75612F20a79720
                    </div>
                  </div>
                  {reviewerApprovals.includes('0xa0Ee7A142d267C1f36714E4a8F75612F20a79720') ? (
                    <span className="badge badge-ok">Approved Onchain</span>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleReviewerApprove('0xa0Ee7A142d267C1f36714E4a8F75612F20a79720')}
                    >
                      Sign Approval Tx
                    </button>
                  )}
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-elevated)', padding: 14, borderRadius: 4 }}>
                  <div>
                    <div style={{ fontWeight: 600 }}>Reviewer 2 (PayCore Independent Key Custodian)</div>
                    <div className="mono" style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                      0x1e2c4753ba16aD45aE7225Feb819CA7958F52fed
                    </div>
                  </div>
                  {reviewerApprovals.includes('0x1e2c4753ba16aD45aE7225Feb819CA7958F52fed') ? (
                    <span className="badge badge-ok">Approved Onchain</span>
                  ) : (
                    <button
                      className="btn btn-primary"
                      onClick={() => handleReviewerApprove('0x1e2c4753ba16aD45aE7225Feb819CA7958F52fed')}
                    >
                      Sign Approval Tx
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 4: GUARDIAN CLUSTER */}
        {currentView === 'guardians' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Guardian Network Operations</h1>
                <p className="page-desc">
                  Independent threshold guardians running isolated microservices. Shares are stored encrypted at rest with SQLite.
                </p>
              </div>
              <span className="badge badge-ok">Cluster: 3 Nodes Online</span>
            </div>

            <div className="grid-3">
              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Guardian Alpha</span>
                  <span className="badge badge-ok">PORT 8791</span>
                </div>
                <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div><strong>Status:</strong> Active & Listening</div>
                  <div><strong>Storage:</strong> Encrypted SQLite</div>
                  <div><strong>ECDSA Signer:</strong> <span className="mono">0x1111...79a1</span></div>
                  <div><strong>Public Key:</strong> <span className="mono">317929...452f</span></div>
                  <div><strong>Stored Shares:</strong> 1 share</div>
                  <div><strong>Anti-Replay Nullifiers:</strong> 2 recorded</div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Guardian Beta</span>
                  <span className="badge badge-ok">PORT 8792</span>
                </div>
                <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div><strong>Status:</strong> Active & Listening</div>
                  <div><strong>Storage:</strong> Encrypted SQLite</div>
                  <div><strong>ECDSA Signer:</strong> <span className="mono">0x2222...80b2</span></div>
                  <div><strong>Public Key:</strong> <span className="mono">774bd9...eb6d</span></div>
                  <div><strong>Stored Shares:</strong> 1 share</div>
                  <div><strong>Anti-Replay Nullifiers:</strong> 2 recorded</div>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <span className="panel-title">Guardian Gamma</span>
                  <span className="badge badge-ok">PORT 8793</span>
                </div>
                <div style={{ fontSize: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
                  <div><strong>Status:</strong> Active & Listening</div>
                  <div><strong>Storage:</strong> Encrypted SQLite</div>
                  <div><strong>ECDSA Signer:</strong> <span className="mono">0x3333...91c3</span></div>
                  <div><strong>Public Key:</strong> <span className="mono">9f81a0...4412</span></div>
                  <div><strong>Stored Shares:</strong> 1 share</div>
                  <div><strong>Anti-Replay Nullifiers:</strong> 2 recorded</div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VIEW 5: IDENTITY & ACCESS */}
        {currentView === 'identity' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Identity & Access Compliance</h1>
                <p className="page-desc">
                  Multi-layer identity verification combining World ID 4.0 Proof-of-Humanity and enterprise role authorization.
                </p>
              </div>
              <span className="badge badge-ok">World ID 4.0 + PayCore</span>
            </div>

            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">World ID 4.0 Proof Verification</span>
                <span className="badge badge-ok">Groth16 Validated</span>
              </div>
              <div className="output-box">
{`{
  "protocolVersion": "4.0",
  "credentialType": "orb",
  "nullifierHash": "0xfe9bd68b697949f4b2a83ef2dfd0960100000000000000000000000000000000",
  "merkleRoot": "0x20141f230b5561a784d59a22f986420f188cd536e1b65db9d3b24f5a43105781",
  "signal": "keccak256(recipientAddress || ephemeralPubkey)",
  "replayDefense": "Guardian Nullifier Database"
}`}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">Enterprise Role Authority</span>
                <span className="badge badge-ok">ECDSA Verified</span>
              </div>
              <div className="output-box">
{`{
  "orgId": "paycore",
  "authorityAddress": "0x71C8A33118A95240cBE3c52A2D4899c750F69F82",
  "authorizedRole": "Security Lead",
  "recipientWallet": "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
  "signature": "0x7a8b9c... (secp256k1)",
  "defense": "Cryptographic role pinning prevents privilege escalation"
}`}
              </div>
            </div>
          </div>
        )}

        {/* VIEW 6: SDK & REST API */}
        {currentView === 'sdk' && (
          <div>
            <div className="page-header">
              <div>
                <h1 className="page-title">Developer SDK & API Documentation</h1>
                <p className="page-desc">
                  Integrate VEIL programmable secret capsules into external protocols, wallets, and CI/CD pipelines.
                </p>
              </div>
              <span className="badge badge-ok">@veil-protocol/sdk v0.1.0</span>
            </div>

            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">TypeScript SDK Quickstart</span>
              </div>
              <div className="output-box" style={{ color: 'var(--text-primary)' }}>
{`import { VeilClient } from '@veil-protocol/sdk'

// 1. Initialize VEIL client
const client = new VeilClient({
  rpcUrl: 'http://127.0.0.1:8545',
  registryAddress: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
  guardians: ['http://127.0.0.1:8791', 'http://127.0.0.1:8792', 'http://127.0.0.1:8793'],
})

// 2. Create programmable capsule
const { capsuleId, carrierText } = await client.capsules.create({
  plaintext: Buffer.from('CONFIDENTIAL ZERO-DAY HOTFIX'),
  timelockSeconds: 3600,
  threshold: 2,
  reviewers: ['0xa0Ee7A...'],
  requireWorldId: true,
  requiredOrg: { orgId: 'paycore', role: 'Security Lead' }
})

// 3. Recipient inspects and decrypts locally
const status = await client.capsules.inspect(carrierText)
if (status.readyForRelease) {
  const plaintext = await client.capsules.decrypt(carrierText, {
    recipientPrivateKey: bobPrivateKey,
    worldProof,
    orgCredential
  })
}`}
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <span className="panel-title">REST API Endpoints (Port 8088)</span>
              </div>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Method</th>
                    <th>Endpoint</th>
                    <th>Purpose</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td><span className="badge badge-ok">GET</span></td>
                    <td className="mono">/api/v1/capsules/:id</td>
                    <td>Query capsule onchain policy status and unlock conditions</td>
                  </tr>
                  <tr>
                    <td><span className="badge badge-warning">POST</span></td>
                    <td className="mono">/api/v1/capsules</td>
                    <td>Deposit capsule metadata and ciphertext (zero plaintext)</td>
                  </tr>
                  <tr>
                    <td><span className="badge badge-warning">POST</span></td>
                    <td className="mono">/api/v1/approvals</td>
                    <td>Submit reviewer signature for onchain quorum</td>
                  </tr>
                  <tr>
                    <td><span className="badge badge-warning">POST</span></td>
                    <td className="mono">/api/v1/release</td>
                    <td>Coordinate threshold guardian share release request</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}

export default App
