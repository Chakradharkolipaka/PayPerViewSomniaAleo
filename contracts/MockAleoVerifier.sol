// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract MockAleoVerifier {
    bool public isValid;
    uint256 public expiry;

    function setMockResult(bool _isValid, uint256 _expiry) external {
        isValid = _isValid;
        expiry = _expiry;
    }

    function verify(
        bytes calldata,
        uint256,
        address
    ) external view returns (bool, uint256) {
        return (isValid, expiry);
    }
}
