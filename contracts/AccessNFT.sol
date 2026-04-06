// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/utils/Base64.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

contract AccessNFT is ERC721, Ownable {
    using Strings for uint256;

    error NonTransferable();
    error AccessAlreadyActive(address viewer, uint256 videoId);
    error NotAuthorizedMinter();
    error NotAuthorizedBurner();
    error AccessNotFound(address viewer, uint256 videoId);
    error AccessNotExpired(uint256 expiresAt, uint256 currentTime);

    struct AccessData {
        uint256 videoId;
        uint256 expiresAt;
    }

    uint256 private _nextTokenId;
    address public payPerView;
    address public proofVerifier;

    mapping(uint256 => AccessData) public accessData;
    mapping(bytes32 => uint256) public tokenByViewerAndVideo;

    event AccessNftMinted(
        address indexed viewer,
        uint256 indexed videoId,
        uint256 indexed tokenId,
        uint256 expiresAt
    );
    event AccessNftBurned(
        address indexed viewer,
        uint256 indexed videoId,
        uint256 indexed tokenId
    );
    event MinterUpdated(address indexed payPerView);
    event BurnerUpdated(address indexed proofVerifier);

    constructor(
        address initialOwner
    ) ERC721("Somnia PPV Access", "SPPV") Ownable(initialOwner) {}

    modifier onlyPayPerView() {
        if (msg.sender != payPerView) revert NotAuthorizedMinter();
        _;
    }

    modifier onlyBurner() {
        if (msg.sender != proofVerifier) revert NotAuthorizedBurner();
        _;
    }

    function setPayPerView(address _payPerView) external onlyOwner {
        payPerView = _payPerView;
        emit MinterUpdated(_payPerView);
    }

    function setProofVerifier(address _proofVerifier) external onlyOwner {
        proofVerifier = _proofVerifier;
        emit BurnerUpdated(_proofVerifier);
    }

    function mintAccess(
        address viewer,
        uint256 videoId,
        uint256 expiresAt
    ) external onlyPayPerView returns (uint256 tokenId) {
        bytes32 key = _pairKey(viewer, videoId);
        uint256 existingTokenId = tokenByViewerAndVideo[key];

        if (existingTokenId != 0 && _ownerOf(existingTokenId) != address(0)) {
            if (accessData[existingTokenId].expiresAt > block.timestamp) {
                revert AccessAlreadyActive(viewer, videoId);
            }
            _burn(existingTokenId);
        }

        tokenId = ++_nextTokenId;
        tokenByViewerAndVideo[key] = tokenId;
        accessData[tokenId] = AccessData({
            videoId: videoId,
            expiresAt: expiresAt
        });

        _mint(viewer, tokenId);

        emit AccessNftMinted(viewer, videoId, tokenId, expiresAt);
    }

    function burnExpired(address viewer, uint256 videoId) external onlyBurner {
        bytes32 key = _pairKey(viewer, videoId);
        uint256 tokenId = tokenByViewerAndVideo[key];

        if (tokenId == 0 || _ownerOf(tokenId) == address(0)) {
            revert AccessNotFound(viewer, videoId);
        }

        uint256 expiresAt = accessData[tokenId].expiresAt;
        if (expiresAt > block.timestamp) {
            revert AccessNotExpired(expiresAt, block.timestamp);
        }

        _burn(tokenId);
        emit AccessNftBurned(viewer, videoId, tokenId);
    }

    function hasActiveAccess(
        address viewer,
        uint256 videoId
    ) external view returns (bool) {
        uint256 tokenId = tokenByViewerAndVideo[_pairKey(viewer, videoId)];
        if (tokenId == 0 || _ownerOf(tokenId) != viewer) return false;
        return accessData[tokenId].expiresAt > block.timestamp;
    }

    function isExpiredFor(
        address viewer,
        uint256 videoId
    ) external view returns (bool) {
        uint256 tokenId = tokenByViewerAndVideo[_pairKey(viewer, videoId)];
        if (tokenId == 0 || _ownerOf(tokenId) == address(0)) return true;
        return accessData[tokenId].expiresAt <= block.timestamp;
    }

    function tokenURI(
        uint256 tokenId
    ) public view override returns (string memory) {
        _requireOwned(tokenId);

        AccessData memory data = accessData[tokenId];
        string memory json = string.concat(
            '{"name":"Video Access #',
            tokenId.toString(),
            '","description":"30-day non-transferable access rental on Somnia",',
            '"attributes":[{"trait_type":"videoId","value":"',
            data.videoId.toString(),
            '"},{"trait_type":"expiresAt","value":"',
            data.expiresAt.toString(),
            '"}]}'
        );

        return
            string.concat(
                "data:application/json;base64,",
                Base64.encode(bytes(json))
            );
    }

    function approve(address, uint256) public pure override {
        revert NonTransferable();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert NonTransferable();
    }

    function _pairKey(
        address viewer,
        uint256 videoId
    ) private pure returns (bytes32) {
        return keccak256(abi.encodePacked(viewer, videoId));
    }

    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        if (from != address(0) && to != address(0)) {
            revert NonTransferable();
        }
        return from;
    }
}
