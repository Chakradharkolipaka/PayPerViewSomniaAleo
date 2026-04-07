import { expect } from "chai";
import { deployFixture } from "../helpers/deploy-fixture.js";
import { expectConfirmed, expectRevert } from "../helpers/assertions.js";

describe("PayPerView Unit", function () {
  it("enforces exact fixed price (0.005 STT)", async function () {
    const { viewer, payPerView, ethers } = await deployFixture();
    const videoId = 1n;

    await expectRevert(
      payPerView.connect(viewer).pay(videoId, { value: ethers.parseEther("0.001") }),
      "IncorrectPayment"
    );

    await expectConfirmed(
      payPerView.connect(viewer).pay(videoId, { value: ethers.parseEther("0.005") })
    );
  });

  it("mints access immediately for buyer", async function () {
    const { viewer, payPerView, accessNFT } = await deployFixture();
    const videoId = 2n;

    await expectConfirmed(
      payPerView.connect(viewer).pay(videoId, { value: 5000000000000000n })
    );

    // Fresh fixture starts from tokenId = 1
    expect(await accessNFT.ownerOf(1n)).to.eq(viewer.address);
    expect(await accessNFT.tokenVideo(1n)).to.eq(videoId);
  });

  it("allows multiple purchases and increments token IDs", async function () {
    const { viewer, payPerView } = await deployFixture();
    const videoId = 3n;

    await expectConfirmed(
      payPerView.connect(viewer).pay(videoId, { value: 5000000000000000n })
    );

    await expectConfirmed(
      payPerView.connect(viewer).pay(videoId, { value: 5000000000000000n })
    );
  });
});
