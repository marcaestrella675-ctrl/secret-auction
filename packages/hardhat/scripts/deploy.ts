import { ethers } from "hardhat";

async function main() {
  console.log("🚀 Deploying SecretAuction contract...");

  // Get the deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying with account:", deployer.address);

  // Get account balance
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");

  // Deploy contract
  const SecretAuction = await ethers.getContractFactory("SecretAuction");
  const auction = await SecretAuction.deploy();
  
  await auction.waitForDeployment();
  const address = await auction.getAddress();

  console.log("✅ SecretAuction deployed to:", address);
  console.log("🔗 View on Sepolia:", `https://sepolia.etherscan.io/address/${address}`);
  
  // Save deployment info
  console.log("\n📋 Add this to your .env.local:");
  console.log(`NEXT_PUBLIC_CONTRACT_ADDRESS=${address}`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });


