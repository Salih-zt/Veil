// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Test} from "forge-std/Test.sol";
import {VeilPolicyRegistry} from "../src/VeilPolicyRegistry.sol";

contract VeilPolicyRegistryTest is Test {
    VeilPolicyRegistry public registry;

    address public alice = address(0xA11CE); // Creator
    address public bob = address(0xB0B);     // Recipient
    address public judge1 = address(0x1111); // Reviewer 1
    address public judge2 = address(0x2222); // Reviewer 2
    address public judge3 = address(0x3333); // Reviewer 3
    address public mallory = address(0xBAD); // Attacker

    bytes32 public capsuleId = keccak256("capsule-1");
    bytes32 public ciphertextHash = keccak256("ciphertext-data");
    uint64 public unlockTimestamp;
    uint64 public expiryTimestamp;
    uint8 public threshold = 2;
    address[] public reviewers;
    bytes32 public policyHash;

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

    function setUp() public {
        registry = new VeilPolicyRegistry();

        unlockTimestamp = uint64(block.timestamp + 1 hours);
        expiryTimestamp = uint64(block.timestamp + 24 hours);

        reviewers.push(judge1);
        reviewers.push(judge2);
        reviewers.push(judge3);

        policyHash = registry.computePolicyHash(
            capsuleId,
            ciphertextHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );
    }

    // 1. Capsule registration
    function test_createCapsule_success() public {
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit CapsuleCreated(
            capsuleId,
            alice,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            3
        );

        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        (
            address creator,
            bytes32 ctHash,
            bytes32 pHash,
            uint64 unlockTime,
            uint64 expiryTime,
            uint8 thresh,
            uint8 approvals,
            bool revoked,
            bool exists
        ) = registry.getCapsule(capsuleId);

        assertEq(creator, alice);
        assertEq(ctHash, ciphertextHash);
        assertEq(pHash, policyHash);
        assertEq(unlockTime, unlockTimestamp);
        assertEq(expiryTime, expiryTimestamp);
        assertEq(thresh, threshold);
        assertEq(approvals, 0);
        assertFalse(revoked);
        assertTrue(exists);

        address[] memory storedReviewers = registry.getReviewers(capsuleId);
        assertEq(storedReviewers.length, 3);
        assertEq(storedReviewers[0], judge1);
        assertEq(storedReviewers[1], judge2);
        assertEq(storedReviewers[2], judge3);
    }

    // 2. Unauthorized / Duplicate registration
    function test_createCapsule_duplicateRejection() public {
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        vm.expectRevert(
            abi.encodeWithSelector(VeilPolicyRegistry.CapsuleAlreadyExists.selector, capsuleId)
        );
        vm.prank(mallory);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );
    }

    // 3. Valid reviewer approval
    function test_approveRelease_success() public {
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        vm.prank(judge1);
        vm.expectEmit(true, true, false, true);
        emit ReleaseApproved(capsuleId, judge1, 1, threshold);
        registry.approveRelease(capsuleId);

        assertTrue(registry.hasApproved(capsuleId, judge1));
        assertFalse(registry.hasApproved(capsuleId, judge2));

        (,,,,,, uint8 approvals,,) = registry.getCapsule(capsuleId);
        assertEq(approvals, 1);
    }

    // 4. Unauthorized reviewer rejection
    function test_approveRelease_unauthorizedReviewer() public {
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                VeilPolicyRegistry.UnauthorizedReviewer.selector,
                capsuleId,
                mallory
            )
        );
        vm.prank(mallory);
        registry.approveRelease(capsuleId);
    }

    // 5. Duplicate approval rejection
    function test_approveRelease_duplicateApproval() public {
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        vm.prank(judge1);
        registry.approveRelease(capsuleId);

        vm.expectRevert(
            abi.encodeWithSelector(
                VeilPolicyRegistry.AlreadyApproved.selector,
                capsuleId,
                judge1
            )
        );
        vm.prank(judge1);
        registry.approveRelease(capsuleId);
    }

    // 6. Insufficient approval quorum (before threshold)
    function test_isReleaseReady_insufficientQuorum() public {
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        // Advance time past unlock deadline
        vm.warp(unlockTimestamp + 10);

        // 1 of 2 approvals
        vm.prank(judge1);
        registry.approveRelease(capsuleId);

        // Quorum is 2, only 1 approved
        assertFalse(registry.isReleaseReady(capsuleId));
    }

    // 7. Deadline not reached
    function test_isReleaseReady_deadlineNotReached() public {
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        // 2 of 2 approvals met before deadline
        vm.prank(judge1);
        registry.approveRelease(capsuleId);
        vm.prank(judge2);
        registry.approveRelease(capsuleId);

        // Time is still before unlockTimestamp
        vm.warp(unlockTimestamp - 100);

        assertFalse(registry.isReleaseReady(capsuleId));
    }

    // 8. Deadline reached with insufficient quorum
    function test_isReleaseReady_deadlineReachedWithoutQuorum() public {
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        // Zero approvals, time past deadline
        vm.warp(unlockTimestamp + 500);

        assertFalse(registry.isReleaseReady(capsuleId));
    }

    // 9. Successful release eligibility (time + quorum)
    function test_isReleaseReady_success() public {
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        // 2 approvals
        vm.prank(judge1);
        registry.approveRelease(capsuleId);
        vm.prank(judge3);
        registry.approveRelease(capsuleId);

        // Time reached
        vm.warp(unlockTimestamp);

        assertTrue(registry.isReleaseReady(capsuleId));
    }

    // 10. Creator revocation
    function test_revokeCapsule_success() public {
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        // 2 approvals and time passed
        vm.prank(judge1);
        registry.approveRelease(capsuleId);
        vm.prank(judge2);
        registry.approveRelease(capsuleId);
        vm.warp(unlockTimestamp);

        assertTrue(registry.isReleaseReady(capsuleId));

        // Creator revokes
        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit CapsuleRevoked(capsuleId, alice);
        registry.revokeCapsule(capsuleId);

        (,,,,,,, bool revoked,) = registry.getCapsule(capsuleId);
        assertTrue(revoked);

        // Release is no longer ready once revoked
        assertFalse(registry.isReleaseReady(capsuleId));

        // Reviewer cannot approve revoked capsule
        vm.expectRevert(
            abi.encodeWithSelector(VeilPolicyRegistry.CapsuleRevokedError.selector, capsuleId)
        );
        vm.prank(judge3);
        registry.approveRelease(capsuleId);
    }

    // 11. Expiry locks capsule
    function test_isReleaseReady_expiryBlocksRelease() public {
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        vm.prank(judge1);
        registry.approveRelease(capsuleId);
        vm.prank(judge2);
        registry.approveRelease(capsuleId);

        // Warp past expiration
        vm.warp(expiryTimestamp + 1);

        assertFalse(registry.isReleaseReady(capsuleId));

        // Additional approvals rejected once expired
        vm.expectRevert(
            abi.encodeWithSelector(VeilPolicyRegistry.CapsuleExpiredError.selector, capsuleId)
        );
        vm.prank(judge3);
        registry.approveRelease(capsuleId);
    }

    // 12. Invalid policy parameters
    function test_createCapsule_invalidThreshold() public {
        // Threshold 0
        vm.expectRevert(
            abi.encodeWithSelector(VeilPolicyRegistry.InvalidThreshold.selector, 0, 3)
        );
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            0,
            reviewers
        );

        // Threshold > reviewer count
        vm.expectRevert(
            abi.encodeWithSelector(VeilPolicyRegistry.InvalidThreshold.selector, 4, 3)
        );
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            4,
            reviewers
        );
    }

    function test_createCapsule_invalidTimestamps() public {
        uint64 badExpiry = unlockTimestamp - 1; // Expiry before unlock
        bytes32 badHash = registry.computePolicyHash(
            capsuleId,
            ciphertextHash,
            unlockTimestamp,
            badExpiry,
            threshold,
            reviewers
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                VeilPolicyRegistry.InvalidTimestamps.selector,
                unlockTimestamp,
                badExpiry
            )
        );
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            badHash,
            unlockTimestamp,
            badExpiry,
            threshold,
            reviewers
        );
    }

    function test_createCapsule_duplicateReviewers() public {
        address[] memory dupeReviewers = new address[](3);
        dupeReviewers[0] = judge1;
        dupeReviewers[1] = judge2;
        dupeReviewers[2] = judge1; // Duplicate

        bytes32 dupeHash = registry.computePolicyHash(
            capsuleId,
            ciphertextHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            dupeReviewers
        );

        vm.expectRevert(
            abi.encodeWithSelector(VeilPolicyRegistry.DuplicateReviewer.selector, judge1)
        );
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            dupeHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            dupeReviewers
        );
    }

    // 13. Recipient authorization & recipient-specific readiness
    function test_authorizeRecipient_success() public {
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        bytes32 commitment = keccak256("world-id-nullifier-bob");

        vm.prank(alice);
        vm.expectEmit(true, true, false, true);
        emit RecipientAuthorized(capsuleId, bob, commitment);
        registry.authorizeRecipient(capsuleId, bob, commitment);

        assertTrue(registry.isRecipientAuthorized(capsuleId, bob));
        assertEq(registry.recipientIdentityCommitment(capsuleId, bob), commitment);

        // Before conditions met, recipient is not release ready
        assertFalse(registry.isReleaseReadyForRecipient(capsuleId, bob));

        // Meet conditions
        vm.prank(judge1);
        registry.approveRelease(capsuleId);
        vm.prank(judge2);
        registry.approveRelease(capsuleId);
        vm.warp(unlockTimestamp);

        assertTrue(registry.isReleaseReady(capsuleId));
        assertTrue(registry.isReleaseReadyForRecipient(capsuleId, bob));

        // Stranger is NOT ready
        assertFalse(registry.isReleaseReadyForRecipient(capsuleId, mallory));
    }

    // 14. Invalid identity authorization (zero address)
    function test_authorizeRecipient_zeroAddress() public {
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        vm.expectRevert(
            abi.encodeWithSelector(VeilPolicyRegistry.InvalidRecipient.selector, address(0))
        );
        vm.prank(alice);
        registry.authorizeRecipient(capsuleId, address(0), keccak256("nullifier"));
    }

    // 15. Identity attestation replay prevention
    function test_authorizeRecipient_replayPrevention() public {
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        bytes32 commitment = keccak256("single-use-proof");

        vm.prank(alice);
        registry.authorizeRecipient(capsuleId, bob, commitment);

        // Replay the exact same attestation for bob
        bytes32 attestationHash = keccak256(
            abi.encodePacked(capsuleId, bob, commitment)
        );
        vm.expectRevert(
            abi.encodeWithSelector(
                VeilPolicyRegistry.AttestationAlreadyUsed.selector,
                attestationHash
            )
        );
        vm.prank(alice);
        registry.authorizeRecipient(capsuleId, bob, commitment);
    }

    // 16. Policy-hash mismatch
    function test_createCapsule_policyHashMismatch() public {
        bytes32 fakeHash = keccak256("manipulated-policy");

        vm.expectRevert(
            abi.encodeWithSelector(
                VeilPolicyRegistry.PolicyHashMismatch.selector,
                fakeHash,
                policyHash
            )
        );
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            fakeHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );
    }

    // 17. Unauthorized modification attempts (e.g. non-creator revocation)
    function test_revokeCapsule_unauthorized() public {
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                VeilPolicyRegistry.UnauthorizedCreator.selector,
                capsuleId,
                mallory
            )
        );
        vm.prank(mallory);
        registry.revokeCapsule(capsuleId);
    }

    function test_authorizeRecipient_unauthorized() public {
        vm.prank(alice);
        registry.createCapsule(
            capsuleId,
            ciphertextHash,
            policyHash,
            unlockTimestamp,
            expiryTimestamp,
            threshold,
            reviewers
        );

        vm.expectRevert(
            abi.encodeWithSelector(
                VeilPolicyRegistry.UnauthorizedCreator.selector,
                capsuleId,
                mallory
            )
        );
        vm.prank(mallory);
        registry.authorizeRecipient(capsuleId, bob, keccak256("nullifier"));
    }
}
