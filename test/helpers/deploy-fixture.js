import { network } from "hardhat";

export async function getEthers() {
  const { ethers } = await network.connect();
  return ethers;
}

export async function deployFixture() {
  const ethers = await getEthers();
  const [owner, viewer, other] = await ethers.getSigners();

  const AccessNFT = await ethers.getContractFactory("AccessNFT");
  const accessNFT = await AccessNFT.deploy();
  await accessNFT.waitForDeployment();

  const PayPerView = await ethers.getContractFactory("PayPerView");
  const payPerView = await PayPerView.deploy(await accessNFT.getAddress());
  await payPerView.waitForDeployment();

  await (await accessNFT.connect(owner).setMinter(await payPerView.getAddress())).wait();

  return {
    owner,
    viewer,
    other,
    ethers,
    accessNFT,
    payPerView,
  };
}
