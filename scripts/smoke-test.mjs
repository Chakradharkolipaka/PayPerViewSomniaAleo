import hre from "hardhat";

const { ethers } = hre;

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function main() {
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
    await payPerView.getAddress(),
    await accessNFT.getAddress()
  );
  await proofVerifier.waitForDeployment();

  await (await accessNFT.setPayPerView(await payPerView.getAddress())).wait();
  await (await accessNFT.setProofVerifier(await proofVerifier.getAddress())).wait();

  const videoId = 11n;
  const price = ethers.parseEther("0.05");

  await (await payPerView.setVideoPrice(videoId, price)).wait();
  await (await payPerView.connect(viewer).payForVideo(videoId, { value: price })).wait();
  await (await payPerView.activateAccess(viewer.address, videoId)).wait();

  const active = await payPerView.hasActiveAccess(viewer.address, videoId);
  assert(active, "Expected active access after activation");

  const now = Math.floor(Date.now() / 1000);
  await (await mockVerifier.setMockResult(true, now + 3600)).wait();

  const verifyTx = await proofVerifier.verifyAndStream("0x1234", videoId, viewer.address);
  await verifyTx.wait();

  console.log("Smoke test passed: payment -> activation -> proof verify flow is valid.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
