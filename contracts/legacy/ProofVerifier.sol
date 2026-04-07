// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @dev LEGACY CONTRACT
 * This contract was part of the original Somnia->Aleo proof verification bridge.
 * In the new architecture (Phase 1+), proof verification has moved entirely to the backend.
 * Keeping here for historical reference only. Do not deploy to production.
 */

interface IAleoVerifier {
    function verify(
        bytes calldata aleoProof,
        uint256 videoId,
        address viewer
    ) external view returns (bool isValid, uint256 aleoExpiry);
}

interface IAccessNftConsumable {
    function hasActiveAccess(
        address viewer,
        uint256 videoId
    ) external view returns (bool);

    function consumeAccess(
        address viewer,
        uint256 videoId
    ) external returns (uint256 tokenId);
}

contract ProofVerifier {
    error InvalidAleoProof();
    error NoActiveSomniaAccess(address viewer, uint256 videoId);

    IAleoVerifier public immutable aleoVerifier;
    IAccessNftConsumable public immutable accessNFT;

    event ViewAccessConsumed(
        address indexed viewer,
        uint256 indexed videoId,
        uint256 indexed tokenId,
        uint256 timestamp
    );

    constructor(address verifierAddress, address accessNftAddress) {
        aleoVerifier = IAleoVerifier(verifierAddress);
        accessNFT = IAccessNftConsumable(accessNftAddress);
    }

    function verifyAndConsume(
        bytes calldata aleoProof,
        uint256 videoId,
        address viewer
    ) external returns (bool, uint256 tokenId) {
        (bool isValid, ) = aleoVerifier.verify(aleoProof, videoId, viewer);
        if (!isValid) revert InvalidAleoProof();

        if (!accessNFT.hasActiveAccess(viewer, videoId)) {
            revert NoActiveSomniaAccess(viewer, videoId);
        }

        tokenId = accessNFT.consumeAccess(viewer, videoId);

        emit ViewAccessConsumed(viewer, videoId, tokenId, block.timestamp);
        return (true, tokenId);
    }
}
