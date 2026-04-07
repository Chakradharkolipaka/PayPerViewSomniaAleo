import { expect } from "chai";
import { deployFixture } from "../helpers/deploy-fixture.js";
import { expectConfirmed } from "../helpers/assertions.js";

describe("Full Flow Integration", function () {
  it("purchase -> consume", async function () {
    const { viewer, payPerView, accessNFT } = await deployFixture();
    const videoId = 77n;

    await expectConfirmed(payPerView.connect(viewer).pay(videoId, { value: 5000000000000000n }));

    expect(await accessNFT.ownerOf(1n)).to.eq(viewer.address);
    expect(await accessNFT.consumed(1n)).to.eq(false);

    await expectConfirmed(accessNFT.connect(viewer).consumeAccess(1n));

    expect(await accessNFT.consumed(1n)).to.eq(true);
  });
});
