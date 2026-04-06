import { expect } from "chai";
import { ethers } from "hardhat";

describe("Somnia PayPerView flow", function () {
  async function deployFixture() {
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
      await payPerView.getAddress(),
      await accessNFT.getAddress()
    );
    await proofVerifier.waitForDeployment();

    await accessNFT.connect(owner).setPayPerView(await payPerView.getAddress());
    await accessNFT.connect(owner).setProofVerifier(await proofVerifier.getAddress());

    return { owner, viewer, other, accessNFT, payPerView, proofVerifier, mockVerifier };
  }

  it("accepts payment, activates access, and verifies stream proof", async function () {
    const { owner, viewer, payPerView, proofVerifier, mockVerifier } = await deployFixture();
    const videoId = 1n;
    const price = ethers.parseEther("0.2");

    await payPerView.connect(owner).setVideoPrice(videoId, price);

    await expect(payPerView.connect(viewer).payForVideo(videoId, { value: price }))
      .to.emit(payPerView, "PaymentReceived");

    await expect(payPerView.connect(owner).activateAccess(viewer.address, videoId)).to.emit(
      payPerView,
      "AccessActivated"
    );

    expect(await payPerView.hasActiveAccess(viewer.address, videoId)).to.eq(true);

    await mockVerifier.setMockResult(true, Math.floor(Date.now() / 1000) + 3600);

    await expect(
      proofVerifier.connect(owner).verifyAndStream("0x1234", videoId, viewer.address)
    ).to.emit(proofVerifier, "AccessGranted");
  });

  it("allows refund when access is not activated within 24h", async function () {
    const { owner, viewer, payPerView } = await deployFixture();
    const videoId = 2n;
    const price = ethers.parseEther("0.1");

    await payPerView.connect(owner).setVideoPrice(videoId, price);

    await payPerView.connect(viewer).payForVideo(videoId, { value: price });

    await expect(payPerView.connect(viewer).claimRefund(videoId))
      .to.emit(payPerView, "RefundClaimed");
  });

  it("reverts transfer attempts with Non-transferable", async function () {
    const { owner, viewer, other, payPerView, accessNFT } = await deployFixture();
    const videoId = 3n;
    const price = ethers.parseEther("0.12");

    await payPerView.connect(owner).setVideoPrice(videoId, price);
    await payPerView.connect(viewer).payForVideo(videoId, { value: price });
    await payPerView.connect(owner).activateAccess(viewer.address, videoId);

    const tokenId = await accessNFT.tokenByViewerAndVideo(
      ethers.keccak256(ethers.solidityPacked(["address", "uint256"], [viewer.address, videoId]))
    );

    await expect(
      accessNFT.connect(viewer).transferFrom(viewer.address, other.address, tokenId)
    ).to.be.revertedWithCustomError(accessNFT, "NonTransferable");
  });
});
