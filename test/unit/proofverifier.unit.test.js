import { expect } from "chai";
import { deployFixture } from "../helpers/deploy-fixture.js";
import { expectConfirmed, expectRevert } from "../helpers/assertions.js";

describe("ProofVerifier Unit", function () {
  it("reverts with InvalidAleoProof on invalid proof", async function () {
  const { owner, viewer, proofVerifier, mockVerifier } = await deployFixture();

    await mockVerifier.setMockResult(false, Math.floor(Date.now() / 1000) + 1000);

    await expectRevert(
      proofVerifier.connect(owner).verifyAndStream("0x1234", 1n, viewer.address),
      "InvalidAleoProof"
    );
  });

  it("reverts with AleoRecordExpired when aleo expiry is in the past", async function () {
  const { owner, viewer, proofVerifier, mockVerifier } = await deployFixture();

    await mockVerifier.setMockResult(true, 1);

    await expectRevert(
      proofVerifier.connect(owner).verifyAndStream("0x1234", 2n, viewer.address),
      "AleoRecordExpired"
    );
  });

  it("reverts with NoActiveSomniaAccess when no active payment access", async function () {
  const { owner, viewer, proofVerifier, mockVerifier } = await deployFixture();

    await mockVerifier.setMockResult(true, Math.floor(Date.now() / 1000) + 3600);

    await expectRevert(
      proofVerifier.connect(owner).verifyAndStream("0x1234", 3n, viewer.address),
      "NoActiveSomniaAccess"
    );
  });

  it("emits AccessGranted on fully valid path", async function () {
  const { owner, viewer, payPerView, proofVerifier, mockVerifier, ethers } = await deployFixture();
    const videoId = 4n;
    const price = ethers.parseEther("0.05");

    await payPerView.connect(owner).setVideoPrice(videoId, price);
    await payPerView.connect(viewer).payForVideo(videoId, { value: price });
    await payPerView.connect(owner).activateAccess(viewer.address, videoId);

    await mockVerifier.setMockResult(true, Math.floor(Date.now() / 1000) + 3600);

    await expectConfirmed(proofVerifier.connect(owner).verifyAndStream("0x1234", videoId, viewer.address));
  });
});
