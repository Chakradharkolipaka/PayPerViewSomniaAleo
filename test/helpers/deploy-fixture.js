import { network } from "hardhat";

export async function getEthers() {
  const { ethers } = await network.connect();
  return ethers;
}

export async function deployFixture() {
  const ethers = await getEthers();
  const [owner, viewer, other] = await ethers.getSigners();

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

  await (await accessNFT.connect(owner).setPayPerView(await payPerView.getAddress())).wait();
  await (await accessNFT.connect(owner).setProofVerifier(await proofVerifier.getAddress())).wait();

  return {
    owner,
    viewer,
    other,
  ethers,
    accessNFT,
    payPerView,
    proofVerifier,
    mockVerifier,
  };
}
