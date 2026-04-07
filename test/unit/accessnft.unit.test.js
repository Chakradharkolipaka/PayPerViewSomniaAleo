import { expect } from "chai";
import { deployFixture } from "../helpers/deploy-fixture.js";
import { expectConfirmed, expectRevert } from "../helpers/assertions.js";

describe("AccessNFT Unit", function () {
  it("reverts transfer and approval paths", async function () {
    const { viewer, other, accessNFT, payPerView, ethers } = await deployFixture();
    const videoId = 10n;

    await expectConfirmed(payPerView.connect(viewer).pay(videoId, { value: 5000000000000000n }));
    const tokenId = 1n;

    await expectRevert(
      accessNFT.connect(viewer).transferFrom(viewer.address, other.address, tokenId),
      "NonTransferable"
    );
  });

  it("allows only token owner or contract owner to consume access", async function () {
    const { owner, viewer, other, accessNFT, payPerView } = await deployFixture();
    const videoId = 11n;

    await expectConfirmed(payPerView.connect(viewer).pay(videoId, { value: 5000000000000000n }));
    const tokenId = 1n;

    await expectRevert(
      accessNFT.connect(other).consumeAccess(tokenId),
      "NotTokenOwner"
    );

    await expectConfirmed(accessNFT.connect(viewer).consumeAccess(tokenId));
    expect(await accessNFT.consumed(tokenId)).to.eq(true);
  });
});
