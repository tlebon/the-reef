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

  // Deploy ReefAgent
  const ReefAgent = await hre.ethers.getContractFactory("ReefAgent");
  const reefAgent = await ReefAgent.deploy();
  await reefAgent.waitForDeployment();
  const agentAddr = await reefAgent.getAddress();
  console.log(`ReefAgent deployed to: ${agentAddr}`);

  // Deploy ReefResource
  const ReefResource = await hre.ethers.getContractFactory("ReefResource");
  const reefResource = await ReefResource.deploy();
  await reefResource.waitForDeployment();
  const resourceAddr = await reefResource.getAddress();
  console.log(`ReefResource deployed to: ${resourceAddr}`);

  // Deploy ReefTile
  const ReefTile = await hre.ethers.getContractFactory("ReefTile");
  const reefTile = await ReefTile.deploy();
  await reefTile.waitForDeployment();
  const tileAddr = await reefTile.getAddress();
  console.log(`ReefTile deployed to: ${tileAddr}`);

  console.log("\nDeployment complete!");
  console.log(`\nAdd to .env:`);
  console.log(`REEF_WORLD_ADDRESS=${worldAddr}`);
  console.log(`REEF_REPUTATION_ADDRESS=${repAddr}`);
  console.log(`REEF_AGENT_ADDRESS=${agentAddr}`);
  console.log(`REEF_RESOURCE_ADDRESS=${resourceAddr}`);
  console.log(`REEF_TILE_ADDRESS=${tileAddr}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
