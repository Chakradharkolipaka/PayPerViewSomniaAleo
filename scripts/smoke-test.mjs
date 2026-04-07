import { network } from "hardhat";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
  const { ethers } = await network.connect();
  const [owner, viewer] = await ethers.getSigners();

  const AccessNFT = await ethers.getContractFactory("AccessNFT");
  const accessNFT = await AccessNFT.deploy(owner.address);
  await accessNFT.waitForDeployment();

  const PayPerView = await ethers.getContractFactory("PayPerView");
  const payPerView = await PayPerView.deploy(await accessNFT.getAddress(), owner.address);
  await payPerView.waitForDeployment();

  const MockVerifier = await ethers.getContractFactory("MockAleoVerifier");
  const mockVerifier = await MockVerifier.deploy();
  await mockVerifier.waitForDeployment();

  const ProofVerifier = await ethers.getContractFactory("ProofVerifier");
  const proofVerifier = await ProofVerifier.deploy(
    await mockVerifier.getAddress(),
    await accessNFT.getAddress()
  );
  await proofVerifier.waitForDeployment();

  await (await accessNFT.setPayPerView(await payPerView.getAddress())).wait();
  await (await accessNFT.setProofVerifier(await proofVerifier.getAddress())).wait();

  const videoId = 11n;
  const price = ethers.parseEther("0.005");

  await (await payPerView.connect(viewer).payForVideo(videoId, { value: price })).wait();

  const activeBeforeConsume = await payPerView.hasAccess(viewer.address, videoId);
  assert(activeBeforeConsume, "Expected active access after payment");

  await (await mockVerifier.setMockResult(true, 0)).wait();

  const verifyTx = await proofVerifier.verifyAndConsume("0x1234", videoId, viewer.address);
  await verifyTx.wait();

  const activeAfterConsume = await payPerView.hasAccess(viewer.address, videoId);
  assert(!activeAfterConsume, "Expected access to be consumed after successful proof verification");

  console.log("Smoke test passed: payment -> verify -> consume flow is valid.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
