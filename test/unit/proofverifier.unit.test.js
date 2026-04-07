import { expect } from "chai";
import { network } from "hardhat";

describe("ProofVerifier Unit", function () {
  it("reverts at deployment because contract is deprecated", async function () {
    const { ethers } = await network.connect();
    const ProofVerifier = await ethers.getContractFactory("contracts/ProofVerifier.sol:ProofVerifier");

    let reverted = false;
    try {
      await ProofVerifier.deploy();
    } catch (err) {
      reverted = true;
      expect(String(err)).to.contain("DeprecatedContract");
    }

    expect(reverted).to.eq(true);
  });
});
