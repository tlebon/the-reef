const hre = require("hardhat");

async function main() {
  console.log("Deploying new contracts only...\n");

  const ReefAgent = await hre.ethers.getContractFactory("ReefAgent");
  const reefAgent = await ReefAgent.deploy();
  await reefAgent.waitForDeployment();
  const agentAddr = await reefAgent.getAddress();
  console.log(`ReefAgent deployed to: ${agentAddr}`);

  const ReefResource = await hre.ethers.getContractFactory("ReefResource");
  const reefResource = await ReefResource.deploy();
  await reefResource.waitForDeployment();
  const resourceAddr = await reefResource.getAddress();
  console.log(`ReefResource deployed to: ${resourceAddr}`);

  const ReefTile = await hre.ethers.getContractFactory("ReefTile");
  const reefTile = await ReefTile.deploy();
  await reefTile.waitForDeployment();
  const tileAddr = await reefTile.getAddress();
  console.log(`ReefTile deployed to: ${tileAddr}`);

  console.log("\nDeployment complete!");
  console.log(`\nAdd to .env:`);
  console.log(`REEF_AGENT_ADDRESS=${agentAddr}`);
  console.log(`REEF_RESOURCE_ADDRESS=${resourceAddr}`);
  console.log(`REEF_TILE_ADDRESS=${tileAddr}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
