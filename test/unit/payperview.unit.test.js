import { expect } from "chai";
import { deployFixture } from "../helpers/deploy-fixture.js";
import { expectConfirmed, expectRevert } from "../helpers/assertions.js";

describe("PayPerView Unit", function () {
  it("enforces exact fixed price (0.005 STT)", async function () {
    const { viewer, payPerView, ethers } = await deployFixture();
    const videoId = 1n;

    await expectRevert(
      payPerView.connect(viewer).payForVideo(videoId, { value: ethers.parseEther("0.001") }),
      "Incorrect STT amount"
    );

    await expectConfirmed(
      payPerView.connect(viewer).payForVideo(videoId, { value: ethers.parseEther("0.005") })
    );
  });

  it("mints access immediately and tracks purchases", async function () {
    const { viewer, payPerView } = await deployFixture();
    const videoId = 2n;

    await expectConfirmed(
      payPerView.connect(viewer).payForVideo(videoId, { value: 5000000000000000n })
    );

    expect(await payPerView.hasAccess(viewer.address, videoId)).to.eq(true);
    expect(await payPerView.purchases(viewer.address, videoId)).to.eq(1n);
  });

  it("blocks second purchase while active access exists", async function () {
    const { viewer, payPerView } = await deployFixture();
    const videoId = 3n;

    await expectConfirmed(
      payPerView.connect(viewer).payForVideo(videoId, { value: 5000000000000000n })
    );

    await expectRevert(
      payPerView.connect(viewer).payForVideo(videoId, { value: 5000000000000000n }),
      "Active access already exists"
    );
  });
});
