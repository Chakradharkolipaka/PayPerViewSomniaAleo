import { ethers } from "ethers";
import fs from "fs";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });

const ARTIFACTS = {
  accessNFT: "./artifacts/contracts/AccessNFT.sol/AccessNFT.json",
  payPerView: "./artifacts/contracts/PayPerView.sol/PayPerView.json",
  proofVerifier: "./artifacts/contracts/ProofVerifier.sol/ProofVerifier.json",
};

function loadArtifact(path) {
  if (!fs.existsSync(path)) {
    throw new Error(`Artifact not found: ${path}. Run \"npx hardhat compile\" first.`);
  }
  return JSON.parse(fs.readFileSync(path, "utf-8"));
}

async function main() {
  const rpcUrl = process.env.SOMNIA_RPC_URL || "https://dream-rpc.somnia.network/";
  const privateKey = process.env.PRIVATE_KEY;
  const verulinkVerifierAddress = process.env.VERULINK_ALEO_VERIFIER_ADDRESS;

  if (!privateKey) throw new Error("Missing PRIVATE_KEY in .env.local");
  if (!verulinkVerifierAddress) {
    throw new Error("Missing VERULINK_ALEO_VERIFIER_ADDRESS in .env.local");
  }

  const provider = new ethers.JsonRpcProvider(rpcUrl);
  const wallet = new ethers.Wallet(privateKey, provider);

  console.log(`Deploying from ${wallet.address}`);
  console.log(`Somnia RPC: ${rpcUrl}`);

  const accessArtifact = loadArtifact(ARTIFACTS.accessNFT);
  const ppvArtifact = loadArtifact(ARTIFACTS.payPerView);
  const verifierArtifact = loadArtifact(ARTIFACTS.proofVerifier);

  const accessFactory = new ethers.ContractFactory(accessArtifact.abi, accessArtifact.bytecode, wallet);
  const accessNFT = await accessFactory.deploy(wallet.address);
  await accessNFT.waitForDeployment();
  const accessAddress = await accessNFT.getAddress();
  console.log(`AccessNFT deployed: ${accessAddress}`);

  const ppvFactory = new ethers.ContractFactory(ppvArtifact.abi, ppvArtifact.bytecode, wallet);
  const payPerView = await ppvFactory.deploy(accessAddress, wallet.address);
  await payPerView.waitForDeployment();
  const ppvAddress = await payPerView.getAddress();
  console.log(`PayPerView deployed: ${ppvAddress}`);

  const verifierFactory = new ethers.ContractFactory(verifierArtifact.abi, verifierArtifact.bytecode, wallet);
  const proofVerifier = await verifierFactory.deploy(verulinkVerifierAddress, ppvAddress, accessAddress);
  await proofVerifier.waitForDeployment();
  const proofAddress = await proofVerifier.getAddress();
  console.log(`ProofVerifier deployed: ${proofAddress}`);

  const setMinterTx = await accessNFT.setPayPerView(ppvAddress);
  await setMinterTx.wait();

  const setBurnerTx = await accessNFT.setProofVerifier(proofAddress);
  await setBurnerTx.wait();

  console.log("\nDeployment complete:");
  console.log(`NEXT_PUBLIC_ACCESS_NFT_ADDRESS=${accessAddress}`);
  console.log(`NEXT_PUBLIC_PAYPERVIEW_ADDRESS=${ppvAddress}`);
  console.log(`NEXT_PUBLIC_PROOF_VERIFIER_ADDRESS=${proofAddress}`);
  console.log(`NEXT_PUBLIC_SOMNIA_RPC_URL=${rpcUrl}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});