// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

/**
 * @title VeilPolicyRegistry
 * @notice Central policy registry for VEIL programmable secret capsules.
 * Enforces unlock conditions through onchain verification without exposing plaintext,
 * Data Encryption Keys (DEKs), or threshold guardian key shares.
 */
contract VeilPolicyRegistry {
    // ---------------------------------------------------------------------------
    // Data Types
    // ---------------------------------------------------------------------------

    struct Capsule {
        address creator;
        bytes32 ciphertextHash;
        bytes32 policyHash;
        uint64 unlockTimestamp;
        uint64 expiryTimestamp;
        uint8 threshold;
        uint8 approvalCount;
        bool revoked;
        bool exists;
    }

    // ---------------------------------------------------------------------------
    // State Variables
    // ---------------------------------------------------------------------------

    /// @notice capsuleId => Capsule metadata
    mapping(bytes32 => Capsule) private _capsules;

    /// @notice capsuleId => list of authorized reviewers
    mapping(bytes32 => address[]) private _reviewers;

    /// @notice capsuleId => reviewer => isAuthorized
    mapping(bytes32 => mapping(address => bool)) public isReviewer;

    /// @notice capsuleId => reviewer => hasApproved
    mapping(bytes32 => mapping(address => bool)) public hasApproved;

    /// @notice capsuleId => recipient => isAuthorized
    mapping(bytes32 => mapping(address => bool)) public isRecipientAuthorized;

    /// @notice capsuleId => recipient => identityCommitment
    mapping(bytes32 => mapping(address => bytes32)) public recipientIdentityCommitment;

    /// @notice Replay protection: attestationHash => isSpent
    mapping(bytes32 => bool) public isAttestationSpent;

    // ---------------------------------------------------------------------------
    // Events
    // ---------------------------------------------------------------------------

    event CapsuleCreated(
        bytes32 indexed capsuleId,
        address indexed creator,
        bytes32 ciphertextHash,
        bytes32 policyHash,
        uint64 unlockTimestamp,
        uint64 expiryTimestamp,
        uint8 threshold,
        uint256 reviewerCount
    );

    event ReleaseApproved(
        bytes32 indexed capsuleId,
        address indexed reviewer,
        uint8 currentApprovals,
        uint8 threshold
    );

    event CapsuleRevoked(bytes32 indexed capsuleId, address indexed creator);

    event RecipientAuthorized(
        bytes32 indexed capsuleId,
        address indexed recipient,
        bytes32 identityCommitment
    );

    // ---------------------------------------------------------------------------
    // Custom Errors
    // ---------------------------------------------------------------------------

    error CapsuleAlreadyExists(bytes32 capsuleId);
    error CapsuleNotFound(bytes32 capsuleId);
    error InvalidThreshold(uint8 threshold, uint256 reviewerCount);
    error InvalidTimestamps(uint64 unlockTimestamp, uint64 expiryTimestamp);
    error ZeroAddress();
    error DuplicateReviewer(address reviewer);
    error PolicyHashMismatch(bytes32 provided, bytes32 computed);
    error UnauthorizedReviewer(bytes32 capsuleId, address caller);
    error AlreadyApproved(bytes32 capsuleId, address reviewer);
    error CapsuleRevokedError(bytes32 capsuleId);
    error CapsuleExpiredError(bytes32 capsuleId);
    error UnauthorizedCreator(bytes32 capsuleId, address caller);
    error AttestationAlreadyUsed(bytes32 attestationHash);
    error InvalidRecipient(address recipient);

    // ---------------------------------------------------------------------------
    // External Functions
    // ---------------------------------------------------------------------------

    /**
     * @notice Register a new capsule with its immutable release policy.
     * @param capsuleId Unique 32-byte identifier for the capsule.
     * @param ciphertextHash SHA-256 hash of the encrypted payload.
     * @param policyHash Canonical hash of the policy parameters.
     * @param unlockTimestamp Unix timestamp after which the capsule may be released.
     * @param expiryTimestamp Unix timestamp after which the capsule is permanently locked (0 for no expiry).
     * @param threshold Minimum number of reviewer approvals required for release (k).
     * @param reviewers List of distinct reviewer addresses.
     */
    function createCapsule(
        bytes32 capsuleId,
        bytes32 ciphertextHash,
        bytes32 policyHash,
        uint64 unlockTimestamp,
        uint64 expiryTimestamp,
        uint8 threshold,
        address[] calldata reviewers
    ) external {
        if (_capsules[capsuleId].exists) revert CapsuleAlreadyExists(capsuleId);
        if (capsuleId == bytes32(0)) revert CapsuleNotFound(capsuleId);
        if (ciphertextHash == bytes32(0)) revert ZeroAddress();

        uint256 reviewerCount = reviewers.length;
        if (threshold == 0 || threshold > reviewerCount) {
            revert InvalidThreshold(threshold, reviewerCount);
        }

        if (expiryTimestamp != 0 && expiryTimestamp <= unlockTimestamp) {
            revert InvalidTimestamps(unlockTimestamp, expiryTimestamp);
        }

        // Validate reviewers and prevent duplicates or zero addresses
        for (uint256 i = 0; i < reviewerCount; i++) {
            address rev = reviewers[i];
            if (rev == address(0)) revert ZeroAddress();
            if (isReviewer[capsuleId][rev]) revert DuplicateReviewer(rev);
            isReviewer[capsuleId][rev] = true;
            _reviewers[capsuleId].push(rev);
        }

        // Validate policy hash against canonical computation
        bytes32 expectedHash = computePolicyHash(
            capsuleId,
            ciphertextHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );
        if (policyHash != expectedHash) {
            bytes32 expectedPreHash = computePolicyHash(
                capsuleId,
                bytes32(0),
                unlockTimestamp,
                expiryTimestamp,
                threshold,
                reviewers
            );
            if (policyHash != expectedPreHash) {
                revert PolicyHashMismatch(policyHash, expectedHash);
            }
        }

        _capsules[capsuleId] = Capsule({
            creator: msg.sender,
            ciphertextHash: ciphertextHash,
            policyHash: policyHash,
            unlockTimestamp: unlockTimestamp,
            expiryTimestamp: expiryTimestamp,
            threshold: threshold,
            approvalCount: 0,
            revoked: false,
            exists: true
        });

        emit CapsuleCreated(
            capsuleId,
            msg.sender,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewerCount
        );
    }

    /**
     * @notice Submit reviewer approval for releasing a capsule.
     * @param capsuleId Target capsule identifier.
     */
    function approveRelease(bytes32 capsuleId) external {
        Capsule storage c = _capsules[capsuleId];
        if (!c.exists) revert CapsuleNotFound(capsuleId);
        if (c.revoked) revert CapsuleRevokedError(capsuleId);
        if (c.expiryTimestamp != 0 && block.timestamp > c.expiryTimestamp) {
            revert CapsuleExpiredError(capsuleId);
        }
        if (!isReviewer[capsuleId][msg.sender]) {
            revert UnauthorizedReviewer(capsuleId, msg.sender);
        }
        if (hasApproved[capsuleId][msg.sender]) {
            revert AlreadyApproved(capsuleId, msg.sender);
        }

        hasApproved[capsuleId][msg.sender] = true;
        c.approvalCount += 1;

        emit ReleaseApproved(capsuleId, msg.sender, c.approvalCount, c.threshold);
    }

    /**
     * @notice Revoke a capsule before or after release. Only callable by creator.
     * @param capsuleId Target capsule identifier.
     */
    function revokeCapsule(bytes32 capsuleId) external {
        Capsule storage c = _capsules[capsuleId];
        if (!c.exists) revert CapsuleNotFound(capsuleId);
        if (msg.sender != c.creator) revert UnauthorizedCreator(capsuleId, msg.sender);
        if (c.revoked) revert CapsuleRevokedError(capsuleId);

        c.revoked = true;
        emit CapsuleRevoked(capsuleId, msg.sender);
    }

    /**
     * @notice Authorize a recipient for disclosure and bind an identity commitment (e.g. World ID / pubkey hash).
     * @dev Prevents replay attacks on identity attestations.
     * @param capsuleId Target capsule identifier.
     * @param recipient Target recipient address.
     * @param identityCommitment Unique hash or nullifier binding the recipient to this session.
     */
    function authorizeRecipient(
        bytes32 capsuleId,
        address recipient,
        bytes32 identityCommitment
    ) external {
        Capsule storage c = _capsules[capsuleId];
        if (!c.exists) revert CapsuleNotFound(capsuleId);
        if (c.revoked) revert CapsuleRevokedError(capsuleId);
        if (msg.sender != c.creator) revert UnauthorizedCreator(capsuleId, msg.sender);
        if (recipient == address(0)) revert InvalidRecipient(recipient);

        if (identityCommitment != bytes32(0)) {
            bytes32 attestationHash = keccak256(
                abi.encodePacked(capsuleId, recipient, identityCommitment)
            );
            if (isAttestationSpent[attestationHash]) {
                revert AttestationAlreadyUsed(attestationHash);
            }
            isAttestationSpent[attestationHash] = true;
        }

        isRecipientAuthorized[capsuleId][recipient] = true;
        recipientIdentityCommitment[capsuleId][recipient] = identityCommitment;

        emit RecipientAuthorized(capsuleId, recipient, identityCommitment);
    }

    // ---------------------------------------------------------------------------
    // View Functions
    // ---------------------------------------------------------------------------

    /**
     * @notice Check whether a capsule has satisfied all core release conditions.
     * Conditions required:
     *   1. Capsule exists.
     *   2. Not revoked.
     *   3. Current time >= unlockTimestamp.
     *   4. Not expired (current time <= expiryTimestamp, if set).
     *   5. Quorum met: approvalCount >= threshold.
     */
    function isReleaseReady(bytes32 capsuleId) external view returns (bool) {
        Capsule storage c = _capsules[capsuleId];
        if (!c.exists || c.revoked) return false;
        if (block.timestamp < c.unlockTimestamp) return false;
        if (c.expiryTimestamp != 0 && block.timestamp > c.expiryTimestamp) return false;
        if (c.approvalCount < c.threshold) return false;
        return true;
    }

    /**
     * @notice Check whether a capsule is release-ready AND a specific recipient is authorized.
     */
    function isReleaseReadyForRecipient(bytes32 capsuleId, address recipient) external view returns (bool) {
        Capsule storage c = _capsules[capsuleId];
        if (!c.exists || c.revoked) return false;
        if (block.timestamp < c.unlockTimestamp) return false;
        if (c.expiryTimestamp != 0 && block.timestamp > c.expiryTimestamp) return false;
        if (c.approvalCount < c.threshold) return false;
        if (!isRecipientAuthorized[capsuleId][recipient]) return false;
        return true;
    }

    /**
     * @notice Retrieve full capsule metadata.
     */
    function getCapsule(bytes32 capsuleId) external view returns (
        address creator,
        bytes32 ciphertextHash,
        bytes32 policyHash,
        uint64 unlockTimestamp,
        uint64 expiryTimestamp,
        uint8 threshold,
        uint8 approvalCount,
        bool revoked,
        bool exists
    ) {
        Capsule storage c = _capsules[capsuleId];
        if (!c.exists) revert CapsuleNotFound(capsuleId);
        return (
            c.creator,
            c.ciphertextHash,
            c.policyHash,
            c.unlockTimestamp,
            c.expiryTimestamp,
            c.threshold,
            c.approvalCount,
            c.revoked,
            c.exists
        );
    }

    /**
     * @notice Retrieve the list of reviewers for a capsule.
     */
    function getReviewers(bytes32 capsuleId) external view returns (address[] memory) {
        if (!_capsules[capsuleId].exists) revert CapsuleNotFound(capsuleId);
        return _reviewers[capsuleId];
    }

    /**
     * @notice Canonical policy hash calculation compatible with the JavaScript SDK.
     */
    function computePolicyHash(
        bytes32 capsuleId,
        bytes32 ciphertextHash,
        uint64 unlockTimestamp,
        uint64 expiryTimestamp,
        uint8 threshold,
        address[] memory reviewers
    ) public pure returns (bytes32) {
        return keccak256(
            abi.encode(
                capsuleId,
                ciphertextHash,
                unlockTimestamp,
                expiryTimestamp,
                threshold,
                reviewers
            )
        );
    }
}
