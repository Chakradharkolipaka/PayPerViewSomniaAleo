import { expect } from "chai";
import { deployFixture } from "../helpers/deploy-fixture.js";
import { expectConfirmed } from "../helpers/assertions.js";

describe("Full Flow Integration", function () {
  it("purchase -> activation -> proof verify -> AccessGranted", async function () {
  const { owner, viewer, payPerView, proofVerifier, mockVerifier, ethers } = await deployFixture();
    const videoId = 77n;
    const price = ethers.parseEther("0.12");

    await expectConfirmed(payPerView.connect(owner).setVideoPrice(videoId, price));

    await expectConfirmed(payPerView.connect(viewer).payForVideo(videoId, { value: price }));

    await expectConfirmed(payPerView.connect(owner).activateAccess(viewer.address, videoId));

    expect(await payPerView.hasActiveAccess(viewer.address, videoId)).to.eq(true);

    await mockVerifier.setMockResult(true, Math.floor(Date.now() / 1000) + 4 * 3600);

    await expectConfirmed(proofVerifier.connect(owner).verifyAndStream("0x1234", videoId, viewer.address));
  });

  it("enforces 30-day expiry on Somnia side", async function () {
  const { owner, viewer, payPerView, ethers } = await deployFixture();
    const videoId = 88n;
    const price = ethers.parseEther("0.03");

    await payPerView.connect(owner).setVideoPrice(videoId, price);
    await payPerView.connect(viewer).payForVideo(videoId, { value: price });
    await payPerView.connect(owner).activateAccess(viewer.address, videoId);

    expect(await payPerView.hasActiveAccess(viewer.address, videoId)).to.eq(true);

    await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 5]);
    await ethers.provider.send("evm_mine", []);

    expect(await payPerView.hasActiveAccess(viewer.address, videoId)).to.eq(false);
  });
});
