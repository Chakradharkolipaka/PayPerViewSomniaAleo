import { expect } from "chai";
import { network } from "hardhat";

describe("Somnia PayPerView flow", function () {
  async function deployFixture() {
    const { ethers } = await network.connect();
    const [owner, viewer, other] = await ethers.getSigners();

    const AccessNFT = await ethers.getContractFactory("AccessNFT");
    const accessNFT = await AccessNFT.deploy(owner.address);
    await accessNFT.waitForDeployment();

    const PayPerView = await ethers.getContractFactory("PayPerView");
    const payPerView = await PayPerView.deploy(await accessNFT.getAddress(), owner.address);
    await payPerView.waitForDeployment();

    const MockVerifier = await ethers.getContractFactory("MockAleoVerifier");
    const mockVerifier = await MockVerifier.deploy();
    await mockVerifier.waitForDeployment();

    const ProofVerifier = await ethers.getContractFactory("ProofVerifier");
    const proofVerifier = await ProofVerifier.deploy(
      await mockVerifier.getAddress(),
      await accessNFT.getAddress()
    );
    await proofVerifier.waitForDeployment();

    await accessNFT.connect(owner).setPayPerView(await payPerView.getAddress());
    await accessNFT.connect(owner).setProofVerifier(await proofVerifier.getAddress());

    return { owner, viewer, other, accessNFT, payPerView, proofVerifier, mockVerifier };
  }

  it("accepts fixed payment, grants access, and consumes on verify", async function () {
    const { viewer, payPerView, proofVerifier, mockVerifier } = await deployFixture();
    const videoId = 1n;
    const { ethers } = await network.connect();
    const price = ethers.parseEther("0.005");

    const payTx = await payPerView.connect(viewer).payForVideo(videoId, { value: price });
    await payTx.wait();

    expect(await payPerView.hasAccess(viewer.address, videoId)).to.eq(true);

    await mockVerifier.setMockResult(true, 0);

    const verifyTx = await proofVerifier.verifyAndConsume(
      "0x1234",
      videoId,
      viewer.address
    );
    await verifyTx.wait();

    expect(await payPerView.hasAccess(viewer.address, videoId)).to.eq(false);
  });

  it("rejects incorrect payment amount", async function () {
    const { viewer, payPerView } = await deployFixture();
    const videoId = 2n;
    const { ethers } = await network.connect();

    let reverted = false;
    try {
      await payPerView
        .connect(viewer)
        .payForVideo(videoId, { value: ethers.parseEther("0.001") });
    } catch (error) {
      reverted = true;
      expect(String(error)).to.contain("Incorrect STT amount");
    }

    expect(reverted).to.eq(true);
  });

  it("reverts transfer attempts with Non-transferable", async function () {
    const { viewer, other, payPerView, accessNFT } = await deployFixture();
    const videoId = 3n;
    const { ethers } = await network.connect();
    const price = ethers.parseEther("0.005");

    await payPerView.connect(viewer).payForVideo(videoId, { value: price });

    const tokenId = await accessNFT.tokenByViewerAndVideo(
      ethers.keccak256(ethers.solidityPacked(["address", "uint256"], [viewer.address, videoId]))
    );

    let reverted = false;
    try {
      await accessNFT.connect(viewer).transferFrom(viewer.address, other.address, tokenId);
    } catch (error) {
      reverted = true;
      expect(String(error)).to.contain("NonTransferable");
    }

    expect(reverted).to.eq(true);
  });
});
