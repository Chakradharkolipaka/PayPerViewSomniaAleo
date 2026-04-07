import { expect } from "chai";
import { deployFixture } from "../helpers/deploy-fixture.js";
import { expectConfirmed, expectRevert } from "../helpers/assertions.js";

describe("AccessNFT Unit", function () {
  it("reverts transfer and approval paths", async function () {
    const { viewer, other, accessNFT, payPerView, ethers } = await deployFixture();
    const videoId = 10n;

    await expectConfirmed(
      payPerView.connect(viewer).payForVideo(videoId, { value: 5000000000000000n })
    );

    const key = ethers.keccak256(
      ethers.solidityPacked(["address", "uint256"], [viewer.address, videoId])
    );
    const tokenId = await accessNFT.tokenByViewerAndVideo(key);

    await expectRevert(
      accessNFT.connect(viewer).transferFrom(viewer.address, other.address, tokenId),
      "NonTransferable"
    );
  });

  it("allows only burner to consume access", async function () {
    const { owner, viewer, accessNFT, payPerView, proofVerifier, ethers } = await deployFixture();
    const videoId = 11n;

    await expectConfirmed(
      payPerView.connect(viewer).payForVideo(videoId, { value: 5000000000000000n })
    );

    await expectRevert(
      accessNFT.connect(owner).consumeAccess(viewer.address, videoId),
      "NotAuthorizedBurner"
    );

    const burner = await proofVerifier.getAddress();
    await ethers.provider.send("hardhat_impersonateAccount", [burner]);
    await ethers.provider.send("hardhat_setBalance", [burner, "0x3635C9ADC5DEA00000"]);
    const burnerSigner = await ethers.getSigner(burner);

    await expectConfirmed(accessNFT.connect(burnerSigner).consumeAccess(viewer.address, videoId));

    await ethers.provider.send("hardhat_stopImpersonatingAccount", [burner]);

    expect(await accessNFT.hasActiveAccess(viewer.address, videoId)).to.eq(false);
  });
});
