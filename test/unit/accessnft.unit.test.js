import { expect } from "chai";
import { deployFixture } from "../helpers/deploy-fixture.js";
import { expectConfirmed, expectRevert } from "../helpers/assertions.js";

describe("AccessNFT Unit", function () {
  it("reverts transfer and approval paths", async function () {
    const { owner, viewer, other, accessNFT, payPerView, ethers } = await deployFixture();
    const videoId = 100n;
    const price = ethers.parseEther("0.1");

    await payPerView.connect(owner).setVideoPrice(videoId, price);
    await payPerView.connect(viewer).payForVideo(videoId, { value: price });
    await payPerView.connect(owner).activateAccess(viewer.address, videoId);

    const key = ethers.keccak256(ethers.solidityPacked(["address", "uint256"], [viewer.address, videoId]));
    const tokenId = await accessNFT.tokenByViewerAndVideo(key);

    await expectRevert(
      accessNFT.connect(viewer).transferFrom(viewer.address, other.address, tokenId),
      "NonTransferable"
    );

    await expectRevert(accessNFT.connect(viewer).approve(other.address, tokenId), "NonTransferable");

    await expectRevert(
      accessNFT.connect(viewer).setApprovalForAll(other.address, true),
      "NonTransferable"
    );
  });

  it("enforces single active token per (viewer, videoId)", async function () {
    const { owner, viewer, accessNFT, payPerView, ethers } = await deployFixture();
    const videoId = 101n;
    const price = ethers.parseEther("0.1");

    await payPerView.connect(owner).setVideoPrice(videoId, price);
    await payPerView.connect(viewer).payForVideo(videoId, { value: price });
    await payPerView.connect(owner).activateAccess(viewer.address, videoId);

    const key = ethers.keccak256(ethers.solidityPacked(["address", "uint256"], [viewer.address, videoId]));
    const firstTokenId = await accessNFT.tokenByViewerAndVideo(key);

    const firstAccessData = await accessNFT.accessData(firstTokenId);

    await expectRevert(
      accessNFT.connect(owner).mintAccess(viewer.address, videoId, firstAccessData.expiresAt),
      "NotAuthorizedMinter"
    );
  });

  it("burns only expired token from authorized burner", async function () {
    const { owner, viewer, accessNFT, payPerView, proofVerifier, ethers } = await deployFixture();
    const videoId = 102n;
    const price = ethers.parseEther("0.1");

    await payPerView.connect(owner).setVideoPrice(videoId, price);
    await payPerView.connect(viewer).payForVideo(videoId, { value: price });
    await payPerView.connect(owner).activateAccess(viewer.address, videoId);

  const key = ethers.keccak256(ethers.solidityPacked(["address", "uint256"], [viewer.address, videoId]));
  const tokenId = await accessNFT.tokenByViewerAndVideo(key);

    await expectRevert(
      accessNFT.connect(owner).burnExpired(viewer.address, videoId),
      "NotAuthorizedBurner"
    );

    await ethers.provider.send("evm_increaseTime", [30 * 24 * 60 * 60 + 2]);
    await ethers.provider.send("evm_mine", []);

    const burner = await proofVerifier.getAddress();
    await ethers.provider.send("hardhat_impersonateAccount", [burner]);
    await ethers.provider.send("hardhat_setBalance", [burner, "0x3635C9ADC5DEA00000"]); // 1000 ETH
    const burnerSigner = await ethers.getSigner(burner);

    await expectConfirmed(accessNFT.connect(burnerSigner).burnExpired(viewer.address, videoId));

    await ethers.provider.send("hardhat_stopImpersonatingAccount", [burner]);

    await expectRevert(accessNFT.tokenURI(tokenId), "ERC721NonexistentToken");
  });

  it("tokenURI contains videoId and expiresAt metadata", async function () {
    const { owner, viewer, accessNFT, payPerView, ethers } = await deployFixture();
    const videoId = 103n;
    const price = ethers.parseEther("0.1");

    await payPerView.connect(owner).setVideoPrice(videoId, price);
    await payPerView.connect(viewer).payForVideo(videoId, { value: price });
    await payPerView.connect(owner).activateAccess(viewer.address, videoId);

    const key = ethers.keccak256(ethers.solidityPacked(["address", "uint256"], [viewer.address, videoId]));
    const tokenId = await accessNFT.tokenByViewerAndVideo(key);

    const uri = await accessNFT.tokenURI(tokenId);
    expect(uri).to.contain("data:application/json;base64,");

    const raw = Buffer.from(uri.split(",")[1], "base64").toString("utf8");
    expect(raw).to.contain("videoId");
    expect(raw).to.contain("expiresAt");
  });
});
