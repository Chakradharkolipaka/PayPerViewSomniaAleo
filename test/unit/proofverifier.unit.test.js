import { expect } from "chai";
import { deployFixture } from "../helpers/deploy-fixture.js";
import { expectConfirmed, expectRevert } from "../helpers/assertions.js";

describe("ProofVerifier Unit", function () {
  it("reverts on invalid Aleo proof", async function () {
    const { owner, viewer, proofVerifier, mockVerifier } = await deployFixture();

    await mockVerifier.setMockResult(false, 0);

    await expectRevert(
      proofVerifier.connect(owner).verifyAndConsume("0x1234", 1n, viewer.address),
      "InvalidAleoProof"
    );
  });

  it("reverts if viewer has no active Somnia access", async function () {
    const { owner, viewer, proofVerifier, mockVerifier } = await deployFixture();

    await mockVerifier.setMockResult(true, 0);

    await expectRevert(
      proofVerifier.connect(owner).verifyAndConsume("0x1234", 2n, viewer.address),
      "NoActiveSomniaAccess"
    );
  });

  it("consumes NFT when proof is valid", async function () {
    const { owner, viewer, payPerView, proofVerifier, mockVerifier } = await deployFixture();
    const videoId = 3n;

    await expectConfirmed(
      payPerView.connect(viewer).payForVideo(videoId, { value: 5000000000000000n })
    );

    await mockVerifier.setMockResult(true, 0);

    await expectConfirmed(
      proofVerifier.connect(owner).verifyAndConsume("0x1234", videoId, viewer.address)
    );

    expect(await payPerView.hasAccess(viewer.address, videoId)).to.eq(false);
  });
});
