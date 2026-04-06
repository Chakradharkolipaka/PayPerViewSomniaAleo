// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

interface IAccessNFTMinter {
    function mintAccess(
        address viewer,
        uint256 videoId,
        uint256 expiresAt
    ) external returns (uint256 tokenId);

    function hasActiveAccess(
        address viewer,
        uint256 videoId
    ) external view returns (bool);
}

contract PayPerView is Ownable, ReentrancyGuard {
    uint256 public constant RENTAL_DURATION = 30 days;
    uint256 public constant REFUND_WINDOW = 24 hours;

    struct Payment {
        uint256 amount;
        uint256 paidAt;
        bool refunded;
    }

    IAccessNFTMinter public immutable accessNFT;

    mapping(uint256 => uint256) public videoPrice;
    mapping(address => mapping(uint256 => uint256)) public accessExpiry;
    mapping(address => mapping(uint256 => bool)) public accessActivated;
    mapping(address => mapping(uint256 => Payment)) public payments;

    event PaymentReceived(
        address indexed viewer,
        uint256 indexed videoId,
        uint256 amount,
        uint256 expiry
    );
    event AccessActivated(
        address indexed viewer,
        uint256 indexed videoId,
        uint256 tokenId,
        uint256 expiry
    );
    event RefundClaimed(
        address indexed viewer,
        uint256 indexed videoId,
        uint256 amount
    );
    event VideoPriceUpdated(uint256 indexed videoId, uint256 price);

    constructor(
        address accessNftAddress,
        address initialOwner
    ) Ownable(initialOwner) {
        accessNFT = IAccessNFTMinter(accessNftAddress);
    }

    function setVideoPrice(uint256 videoId, uint256 price) external onlyOwner {
        require(price > 0, "Price must be > 0");
        videoPrice[videoId] = price;
        emit VideoPriceUpdated(videoId, price);
    }

    function payForVideo(uint256 videoId) external payable nonReentrant {
        uint256 price = videoPrice[videoId];
        require(price > 0, "Video unavailable");
        require(msg.value == price, "Incorrect STT amount");
        require(
            !hasActiveAccess(msg.sender, videoId),
            "Already has active access"
        );

        uint256 expiry = block.timestamp + RENTAL_DURATION;

        accessExpiry[msg.sender][videoId] = expiry;
        accessActivated[msg.sender][videoId] = false;
        payments[msg.sender][videoId] = Payment({
            amount: msg.value,
            paidAt: block.timestamp,
            refunded: false
        });

        emit PaymentReceived(msg.sender, videoId, msg.value, expiry);
    }

    function activateAccess(
        address viewer,
        uint256 videoId
    ) external onlyOwner returns (uint256 tokenId) {
        Payment memory payment = payments[viewer][videoId];

        require(payment.amount > 0, "No payment");
        require(!payment.refunded, "Already refunded");
        require(!accessActivated[viewer][videoId], "Already activated");

        uint256 expiry = accessExpiry[viewer][videoId];
        require(expiry > block.timestamp, "Payment expired");

        tokenId = accessNFT.mintAccess(viewer, videoId, expiry);
        accessActivated[viewer][videoId] = true;

        emit AccessActivated(viewer, videoId, tokenId, expiry);
    }

    function claimRefund(uint256 videoId) external nonReentrant {
        Payment storage payment = payments[msg.sender][videoId];

        require(payment.amount > 0, "No payment");
        require(!payment.refunded, "Already refunded");
        require(
            !accessActivated[msg.sender][videoId],
            "Access already activated"
        );
        require(
            block.timestamp <= payment.paidAt + REFUND_WINDOW,
            "Refund window closed"
        );

        uint256 refundAmount = payment.amount;
        payment.refunded = true;
        payment.amount = 0;

        (bool sent, ) = payable(msg.sender).call{value: refundAmount}("");
        require(sent, "Refund failed");

        emit RefundClaimed(msg.sender, videoId, refundAmount);
    }

    function hasActiveAccess(
        address viewer,
        uint256 videoId
    ) public view returns (bool) {
        uint256 expiry = accessExpiry[viewer][videoId];
        if (expiry <= block.timestamp) return false;
        if (!accessActivated[viewer][videoId]) return false;
        return accessNFT.hasActiveAccess(viewer, videoId);
    }
}
