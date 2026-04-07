import { expect } from "chai";
import { deployFixture } from "../helpers/deploy-fixture.js";
import { expectConfirmed } from "../helpers/assertions.js";

describe("Full Flow Integration", function () {
  it("purchase -> verify -> consume", async function () {
    const { owner, viewer, payPerView, proofVerifier, mockVerifier } = await deployFixture();
    const videoId = 77n;

    await expectConfirmed(
      payPerView.connect(viewer).payForVideo(videoId, { value: 5000000000000000n })
    );

    expect(await payPerView.hasAccess(viewer.address, videoId)).to.eq(true);

    await mockVerifier.setMockResult(true, 0);
    await expectConfirmed(
      proofVerifier.connect(owner).verifyAndConsume("0x1234", videoId, viewer.address)
    );

    expect(await payPerView.hasAccess(viewer.address, videoId)).to.eq(false);
  });
});
