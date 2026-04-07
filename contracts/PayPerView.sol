// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IAccessNFT {
    function mintAccess(address to, uint256 videoId) external returns (uint256);
}

/**
 * @title PayPerView
 * @notice Fixed-price single-view payment contract on Somnia.
 * @dev Pay 0.005 STT → mints one AccessNFT → NFT burned on view.
 *
 * POPUP STATES exposed to frontend via events:
 *   PaymentReceived(buyer, videoId, tokenId) → trigger "Payment confirmed" popup
 *   AccessMinted(buyer, videoId, tokenId)    → trigger "Access granted" popup
 */
contract PayPerView is ReentrancyGuard {
    uint256 public constant PRICE = 0.005 ether; // 0.005 STT
    address public immutable owner;
    IAccessNFT public immutable accessNFT;

    event PaymentReceived(
        address indexed buyer,
        uint256 indexed videoId,
        uint256 tokenId
    );
    event AccessMinted(
        address indexed buyer,
        uint256 indexed videoId,
        uint256 tokenId
    );

    error IncorrectPayment(uint256 sent, uint256 required);
    error ZeroAddress();
    error WithdrawFailed();

    constructor(address _accessNFT) {
        if (_accessNFT == address(0)) revert ZeroAddress();
        owner = msg.sender;
        accessNFT = IAccessNFT(_accessNFT);
    }

    /**
     * @notice Pay for single-view access to a video.
     * @param videoId  The video identifier (matches frontend VIDEO_IDS constant).
     * @dev  Reverts with IncorrectPayment if msg.value != PRICE.
     *       Frontend must show popup: "Confirm payment of 0.005 STT in your wallet."
     */
    function pay(
        uint256 videoId
    ) external payable nonReentrant returns (uint256 tokenId) {
        if (msg.value != PRICE) revert IncorrectPayment(msg.value, PRICE);

        emit PaymentReceived(msg.sender, videoId, 0); // tokenId TBD

        tokenId = accessNFT.mintAccess(msg.sender, videoId);

        emit AccessMinted(msg.sender, videoId, tokenId);
    }

    /**
     * @notice Withdraw proceeds from video sales.
     * @dev Only the owner can withdraw.
     */
    function withdraw() external {
        require(msg.sender == owner, "Not owner");
        uint256 balance = address(this).balance;

        (bool sent, ) = payable(owner).call{value: balance}("");
        if (!sent) revert WithdrawFailed();
    }
}
