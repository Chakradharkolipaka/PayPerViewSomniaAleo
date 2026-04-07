import { expect } from "chai";
import { network } from "hardhat";

describe("Somnia PayPerView flow", function () {
  async function deployFixture() {
    const { ethers } = await network.connect();
    const [owner, viewer, other] = await ethers.getSigners();

    const AccessNFT = await ethers.getContractFactory("AccessNFT");
    const accessNFT = await AccessNFT.deploy();
    await accessNFT.waitForDeployment();

    const PayPerView = await ethers.getContractFactory("PayPerView");
    const payPerView = await PayPerView.deploy(await accessNFT.getAddress());
    await payPerView.waitForDeployment();

    await accessNFT.connect(owner).setMinter(await payPerView.getAddress());

    return { owner, viewer, other, accessNFT, payPerView };
  }

  it("accepts fixed payment, grants access, and consumes once", async function () {
    const { viewer, payPerView, accessNFT } = await deployFixture();
    const videoId = 1n;
    const { ethers } = await network.connect();
    const price = ethers.parseEther("0.005");

    const payTx = await payPerView.connect(viewer).pay(videoId, { value: price });
    await payTx.wait();

    expect(await accessNFT.ownerOf(1n)).to.eq(viewer.address);
    expect(await accessNFT.consumed(1n)).to.eq(false);

    await (await accessNFT.connect(viewer).consumeAccess(1n)).wait();

    expect(await accessNFT.consumed(1n)).to.eq(true);
  });

  it("rejects incorrect payment amount", async function () {
    const { viewer, payPerView } = await deployFixture();
    const videoId = 2n;
    const { ethers } = await network.connect();

    let reverted = false;
    try {
      await payPerView.connect(viewer).pay(videoId, { value: ethers.parseEther("0.001") });
    } catch (error) {
      reverted = true;
      expect(String(error)).to.contain("IncorrectPayment");
    }

    expect(reverted).to.eq(true);
  });

  it("reverts transfer attempts with Non-transferable", async function () {
    const { viewer, other, payPerView, accessNFT } = await deployFixture();
    const videoId = 3n;
    const { ethers } = await network.connect();
    const price = ethers.parseEther("0.005");

    await payPerView.connect(viewer).pay(videoId, { value: price });
    const tokenId = 1n;

    let reverted = false;
    try {
      await accessNFT.connect(viewer).transferFrom(viewer.address, other.address, tokenId);
    } catch (error) {
      reverted = true;
      expect(String(error)).to.contain("NonTransferable");
    }

    expect(reverted).to.eq(true);
  });
});
