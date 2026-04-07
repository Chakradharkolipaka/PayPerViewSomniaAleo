// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @dev DEPRECATED - See contracts/legacy/ProofVerifier.sol
 * This contract has been superseded by backend proof verification.
 * To maintain this contract, import from legacy/ folder.
 */

error DeprecatedContract();

contract ProofVerifier {
    constructor() {
        revert DeprecatedContract();
    }
}
