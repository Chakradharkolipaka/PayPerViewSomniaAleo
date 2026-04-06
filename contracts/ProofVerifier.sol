// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

interface IAleoVerifier {
    function verify(
        bytes calldata aleoProof,
        uint256 videoId,
        address viewer
    ) external view returns (bool isValid, uint256 aleoExpiry);
}

interface IPayPerViewAccess {
    function hasActiveAccess(
        address viewer,
        uint256 videoId
    ) external view returns (bool);
}

interface IAccessNftExpirable {
    function isExpiredFor(
        address viewer,
        uint256 videoId
    ) external view returns (bool);

    function burnExpired(address viewer, uint256 videoId) external;
}

contract ProofVerifier {
    error InvalidAleoProof();
    error AleoRecordExpired(uint256 aleoExpiry, uint256 currentTime);
    error NoActiveSomniaAccess(address viewer, uint256 videoId);
    error AccessNftExpiredAndBurned(address viewer, uint256 videoId);

    IAleoVerifier public immutable aleoVerifier;
    IPayPerViewAccess public immutable payPerView;
    IAccessNftExpirable public immutable accessNFT;

    event AccessGranted(
        address indexed viewer,
        uint256 indexed videoId,
        uint256 timestamp
    );

    constructor(
        address verifierAddress,
        address payPerViewAddress,
        address accessNftAddress
    ) {
        aleoVerifier = IAleoVerifier(verifierAddress);
        payPerView = IPayPerViewAccess(payPerViewAddress);
        accessNFT = IAccessNftExpirable(accessNftAddress);
    }

    function verifyAndStream(
        bytes calldata aleoProof,
        uint256 videoId,
        address viewer
    ) external returns (bool) {
        (bool isValid, uint256 aleoExpiry) = aleoVerifier.verify(
            aleoProof,
            videoId,
            viewer
        );
        if (!isValid) revert InvalidAleoProof();
        if (aleoExpiry <= block.timestamp)
            revert AleoRecordExpired(aleoExpiry, block.timestamp);

        if (!payPerView.hasActiveAccess(viewer, videoId)) {
            revert NoActiveSomniaAccess(viewer, videoId);
        }

        if (accessNFT.isExpiredFor(viewer, videoId)) {
            accessNFT.burnExpired(viewer, videoId);
            revert AccessNftExpiredAndBurned(viewer, videoId);
        }

        emit AccessGranted(viewer, videoId, block.timestamp);
        return true;
    }
}
