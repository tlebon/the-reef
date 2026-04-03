const hre = require("hardhat");

async function main() {
  console.log("Deploying The Reef contracts...\n");

  // Deploy ReefWorld
  const ReefWorld = await hre.ethers.getContractFactory("ReefWorld");
  const reefWorld = await ReefWorld.deploy();
  await reefWorld.waitForDeployment();
  const worldAddr = await reefWorld.getAddress();
  console.log(`ReefWorld deployed to: ${worldAddr}`);

  // Deploy ReefReputation
  const ReefReputation = await hre.ethers.getContractFactory("ReefReputation");
  const reefReputation = await ReefReputation.deploy();
  await reefReputation.waitForDeployment();
  const repAddr = await reefReputation.getAddress();
  console.log(`ReefReputation deployed to: ${repAddr}`);

  console.log("\nDeployment complete!");
  console.log(`\nAdd to .env:\nREEF_WORLD_ADDRESS=${worldAddr}\nREEF_REPUTATION_ADDRESS=${repAddr}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
