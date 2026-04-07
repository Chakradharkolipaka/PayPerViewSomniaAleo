// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AccessNFT
 * @notice Non-transferable single-use access token for PayPerView.
 * @dev Minted by PayPerView.sol. Burned by backend after view confirmed.
 *
 * POPUP STATES:
 *   Minted → "Your access token is ready. You have 1 view available."
 *   Burned → "View consumed. Purchase again for another view."
 */
contract AccessNFT is ERC721, Ownable {
    address public minter;
    uint256 private _nextId;

    // videoId per tokenId
    mapping(uint256 => uint256) public tokenVideo;
    // has token been used
    mapping(uint256 => bool) public consumed;

    event AccessConsumed(
        address indexed viewer,
        uint256 indexed tokenId,
        uint256 videoId
    );

    error NotMinter();
    error AlreadyConsumed(uint256 tokenId);
    error NotTokenOwner(uint256 tokenId);
    error NonTransferable();

    constructor() ERC721("PayPerViewAccess", "PPVA") Ownable(msg.sender) {}

    function setMinter(address _minter) external onlyOwner {
        minter = _minter;
    }

    /**
     * @notice Mint a single-use access token. Called only by PayPerView.sol.
     */
    function mintAccess(
        address to,
        uint256 videoId
    ) external returns (uint256 tokenId) {
        if (msg.sender != minter) revert NotMinter();
        tokenId = ++_nextId;
        _mint(to, tokenId);
        tokenVideo[tokenId] = videoId;
    }

    /**
     * @notice Burn token after confirmed view. Called by trusted backend wallet.
     * @dev Backend must call this after delivering decryption key.
     */
    function consumeAccess(uint256 tokenId) external {
        if (consumed[tokenId]) revert AlreadyConsumed(tokenId);
        if (ownerOf(tokenId) != msg.sender && msg.sender != owner())
            revert NotTokenOwner(tokenId);
        consumed[tokenId] = true;
        _burn(tokenId);
        emit AccessConsumed(msg.sender, tokenId, tokenVideo[tokenId]);
    }

    /// @dev Allow only mint (from=0) and burn (to=0), block peer-to-peer transfers.
    function _update(
        address to,
        uint256 tokenId,
        address auth
    ) internal override returns (address from) {
        from = _ownerOf(tokenId);

        // Block transfer when both sender and receiver are non-zero.
        if (from != address(0) && to != address(0)) {
            revert NonTransferable();
        }

        return super._update(to, tokenId, auth);
    }

    /// @dev Remove approval functionality
    function approve(address, uint256) public pure override {
        revert NonTransferable();
    }

    /// @dev Remove approval functionality
    function setApprovalForAll(address, bool) public pure override {
        revert NonTransferable();
    }
}
