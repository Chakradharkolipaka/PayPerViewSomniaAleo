import { expect } from "chai";
import { deployFixture } from "../helpers/deploy-fixture.js";
import { expectConfirmed, expectRevert } from "../helpers/assertions.js";

describe("PayPerView Unit", function () {
  it("sets price and accepts exact STT payment", async function () {
  const { owner, viewer, payPerView, ethers } = await deployFixture();
    const videoId = 1n;
    const price = ethers.parseEther("0.2");

    await expectConfirmed(payPerView.connect(owner).setVideoPrice(videoId, price));

    await expectConfirmed(payPerView.connect(viewer).payForVideo(videoId, { value: price }));

  const payment = await payPerView.payments(viewer.address, videoId);
  expect(payment.amount).to.eq(price);
  expect(payment.refunded).to.eq(false);
  });

  it("rejects wrong payment amounts", async function () {
  const { owner, viewer, payPerView, ethers } = await deployFixture();
    const videoId = 2n;
    const price = ethers.parseEther("0.2");

    await payPerView.connect(owner).setVideoPrice(videoId, price);

    await expectRevert(
      payPerView.connect(viewer).payForVideo(videoId, { value: ethers.parseEther("0.1") })
    ,"Incorrect STT amount");
  });

  it("activates access and then reports active access", async function () {
  const { owner, viewer, payPerView, ethers } = await deployFixture();
    const videoId = 3n;
    const price = ethers.parseEther("0.05");

    await payPerView.connect(owner).setVideoPrice(videoId, price);
    await payPerView.connect(viewer).payForVideo(videoId, { value: price });

    await expectConfirmed(payPerView.connect(owner).activateAccess(viewer.address, videoId));

    expect(await payPerView.hasActiveAccess(viewer.address, videoId)).to.eq(true);
  });

  it("allows refund within 24 hours if not activated", async function () {
  const { owner, viewer, payPerView, ethers } = await deployFixture();
    const videoId = 4n;
    const price = ethers.parseEther("0.08");

    await payPerView.connect(owner).setVideoPrice(videoId, price);
    await payPerView.connect(viewer).payForVideo(videoId, { value: price });

    await expectConfirmed(payPerView.connect(viewer).claimRefund(videoId));

  const payment = await payPerView.payments(viewer.address, videoId);
  expect(payment.refunded).to.eq(true);
  });

  it("blocks refund after 24 hours", async function () {
  const { owner, viewer, payPerView, ethers } = await deployFixture();
    const videoId = 5n;
    const price = ethers.parseEther("0.08");

    await payPerView.connect(owner).setVideoPrice(videoId, price);
    await payPerView.connect(viewer).payForVideo(videoId, { value: price });

    await ethers.provider.send("evm_increaseTime", [24 * 60 * 60 + 1]);
    await ethers.provider.send("evm_mine", []);

    await expectRevert(payPerView.connect(viewer).claimRefund(videoId), "Refund window closed");
  });

  it("blocks second activation and re-pay while active", async function () {
  const { owner, viewer, payPerView, ethers } = await deployFixture();
    const videoId = 6n;
    const price = ethers.parseEther("0.09");

    await payPerView.connect(owner).setVideoPrice(videoId, price);
    await payPerView.connect(viewer).payForVideo(videoId, { value: price });
    await payPerView.connect(owner).activateAccess(viewer.address, videoId);

    await expectRevert(
      payPerView.connect(owner).activateAccess(viewer.address, videoId),
      "Already activated"
    );

    await expectRevert(
      payPerView.connect(viewer).payForVideo(videoId, { value: price }),
      "Already has active access"
    );
  });
});
