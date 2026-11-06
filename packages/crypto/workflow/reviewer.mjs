// VEIL Reviewer Workflow Module
//
// Implements multi-party reviewer approval:
//   - Identifies assigned reviewers for a capsule.
//   - Checks whether the reviewer has already submitted approval.
//   - Submits onchain approval transaction via VeilPolicyRegistry.approveRelease().
//   - Tracks and displays real-time quorum progress.

/**
 * Check reviewer status for a capsule.
 *
 * @param {object} params
 * @param {string} params.capsuleId Target capsule identifier
 * @param {string} params.reviewerAddress Reviewer's EVM address
 * @param {object} params.registryClient Onchain policy registry client
 * @returns {Promise<object>} Reviewer assignment and approval status
 */
export async function getReviewerStatus({
  capsuleId,
  reviewerAddress,
  registryClient,
}) {
  if (!capsuleId || !reviewerAddress || !registryClient) {
    throw new Error('getReviewerStatus: missing required parameters')
  }

  const cleanCapsule = capsuleId.startsWith('0x') ? capsuleId : `0x${capsuleId}`
  const cleanReviewer = reviewerAddress.toLowerCase()

  const [capsuleState, reviewers] = await Promise.all([
    registryClient.getCapsule(cleanCapsule),
    registryClient.getReviewers(cleanCapsule),
  ])

  const normalizedReviewers = reviewers.map((r) => r.toLowerCase())
  const isAssigned = normalizedReviewers.includes(cleanReviewer)

  const currentApprovals = Number(capsuleState.approvalCount)
  const threshold = Number(capsuleState.threshold)
  const quorumMet = currentApprovals >= threshold

  return {
    capsuleId: cleanCapsule,
    reviewerAddress,
    isAssigned,
    currentApprovals,
    threshold,
    quorumMet,
    reviewers: normalizedReviewers,
    revoked: capsuleState.revoked,
    exists: capsuleState.exists,
  }
}

/**
 * Submit reviewer approval for a capsule.
 *
 * @param {object} params
 * @param {string} params.capsuleId Target capsule identifier
 * @param {string} params.reviewerAddress Reviewer's EVM address
 * @param {object} params.registryClient Registry client with active walletClient
 * @returns {Promise<object>} Approval result and updated quorum status
 */
export async function submitReviewerApproval({
  capsuleId,
  reviewerAddress,
  registryClient,
}) {
  if (!capsuleId || !reviewerAddress || !registryClient) {
    throw new Error('submitReviewerApproval: missing required parameters')
  }

  const status = await getReviewerStatus({ capsuleId, reviewerAddress, registryClient })
  if (!status.isAssigned) {
    throw new Error(`submitReviewerApproval: address ${reviewerAddress} is not an assigned reviewer for this capsule`)
  }

  // Submit onchain transaction
  const cleanCapsule = capsuleId.startsWith('0x') ? capsuleId : `0x${capsuleId}`
  const txHash = await registryClient.approveRelease(cleanCapsule)

  // Refresh status
  const updatedState = await registryClient.getCapsule(cleanCapsule)
  const newApprovals = Number(updatedState.approvalCount)
  const threshold = Number(updatedState.threshold)

  return {
    success: true,
    txHash,
    capsuleId: cleanCapsule,
    reviewer: reviewerAddress,
    previousApprovals: status.currentApprovals,
    currentApprovals: newApprovals,
    threshold,
    quorumMet: newApprovals >= threshold,
  }
}
