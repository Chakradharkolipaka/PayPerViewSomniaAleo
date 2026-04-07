import { network } from "hardhat";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const { ethers } = await network.connect();
  const [owner, viewer] = await ethers.getSigners();

  const AccessNFT = await ethers.getContractFactory("AccessNFT");
  const accessNFT = await AccessNFT.deploy();
  await accessNFT.waitForDeployment();

  const PayPerView = await ethers.getContractFactory("PayPerView");
  const payPerView = await PayPerView.deploy(await accessNFT.getAddress());
  await payPerView.waitForDeployment();

  await (await accessNFT.setMinter(await payPerView.getAddress())).wait();

  const videoId = 11n;
  const price = ethers.parseEther("0.005");

  await (await payPerView.connect(viewer).pay(videoId, { value: price })).wait();
  assert((await accessNFT.ownerOf(1n)) === viewer.address, "Expected viewer to own tokenId=1");

  await (await accessNFT.connect(viewer).consumeAccess(1n)).wait();
  assert(await accessNFT.consumed(1n), "Expected token to be consumed");

  console.log("Smoke test passed: payment -> mint -> consume flow is valid.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
