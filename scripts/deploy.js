import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const ARTIFACTS = {
  accessNFT: "./artifacts/contracts/AccessNFT.sol/AccessNFT.json",
  payPerView: "./artifacts/contracts/PayPerView.sol/PayPerView.json",
};

function loadArtifact(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Artifact not found: ${path}. Run \"npx hardhat compile\" first.`);
  }
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

async function main() {
  const rpcUrl =
    process.env.SOMNIA_RPC_URL ||
    process.env.NEXT_PUBLIC_SOMNIA_RPC_URL ||
    "https://dream-rpc.somnia.network/";
  const rawPrivateKey = process.env.PRIVATE_KEY;

  if (!rawPrivateKey) {
    throw new Error("Missing PRIVATE_KEY in .env.local");
  }

  const privateKey = rawPrivateKey.startsWith("0x") ? rawPrivateKey : `0x${rawPrivateKey}`;

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`Deploying from ${wallet.address}`);
  console.log(`Somnia RPC: ${rpcUrl}`);

  const accessArtifact = loadArtifact(ARTIFACTS.accessNFT);
  const ppvArtifact = loadArtifact(ARTIFACTS.payPerView);

  const accessFactory = new ethers.ContractFactory(accessArtifact.abi, accessArtifact.bytecode, wallet);
  const accessNFT = await accessFactory.deploy();
  await accessNFT.waitForDeployment();
  const accessAddress = await accessNFT.getAddress();
  console.log(`AccessNFT deployed: ${accessAddress}`);

  const ppvFactory = new ethers.ContractFactory(ppvArtifact.abi, ppvArtifact.bytecode, wallet);
  const payPerView = await ppvFactory.deploy(accessAddress);
  await payPerView.waitForDeployment();
  const ppvAddress = await payPerView.getAddress();
  console.log(`PayPerView deployed: ${ppvAddress}`);

  const setMinterTx = await accessNFT.setMinter(ppvAddress);
  await setMinterTx.wait();

  console.log("\nDeployment complete:");
  console.log(`SOMNIA_RPC_URL=${rpcUrl}`);
  console.log(`NEXT_PUBLIC_SOMNIA_RPC_URL=${rpcUrl}`);
  console.log(`NEXT_PUBLIC_ACCESS_NFT_ADDRESS=${accessAddress}`);
  console.log(`NEXT_PUBLIC_PAYPERVIEW_ADDRESS=${ppvAddress}`);
  console.log(`ACCESS_NFT_ADDRESS=${accessAddress}`);
  console.log(`BACKEND_PRIVATE_KEY=<set this to backend signer private key>`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});