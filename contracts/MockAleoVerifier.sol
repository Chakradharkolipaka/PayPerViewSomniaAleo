// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @dev DEPRECATED - See contracts/legacy/MockAleoVerifier.sol
 * This contract is kept for test compatibility only.
 */

error DeprecatedContract();

contract MockAleoVerifier {
    constructor() {
        revert DeprecatedContract();
    }
}
