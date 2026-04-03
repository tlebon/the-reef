const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReefWorld", function () {
  let reefWorld, operator, other;

  beforeEach(async function () {
    [operator, other] = await ethers.getSigners();
    const ReefWorld = await ethers.getContractFactory("ReefWorld");
    reefWorld = await ReefWorld.deploy();
  });

  it("should commit sequential ticks", async function () {
    const hash1 = ethers.keccak256(ethers.toUtf8Bytes("state1"));
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes("state2"));

    await reefWorld.commitTick(1, hash1);
    await reefWorld.commitTick(2, hash2);

    expect(await reefWorld.latestTick()).to.equal(2);
    expect(await reefWorld.verifyTick(1, hash1)).to.be.true;
    expect(await reefWorld.verifyTick(2, hash2)).to.be.true;
  });

  it("should reject non-sequential ticks", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("state"));
    await expect(reefWorld.commitTick(5, hash)).to.be.revertedWith("ReefWorld: tick must be sequential");
  });

  it("should reject non-operator", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("state"));
    await expect(reefWorld.connect(other).commitTick(1, hash)).to.be.revertedWith("ReefWorld: not operator");
  });
});

describe("ReefReputation", function () {
  let reefRep, deployer, agent1, agent2;

  beforeEach(async function () {
    [deployer, agent1, agent2] = await ethers.getSigners();
    const ReefReputation = await ethers.getContractFactory("ReefReputation");
    reefRep = await ReefReputation.deploy();
  });

  it("should register agents", async function () {
    await reefRep.registerAgent(agent1.address);
    expect(await reefRep.getAgentCount()).to.equal(1);
  });

  it("should reject duplicate registration", async function () {
    await reefRep.registerAgent(agent1.address);
    await expect(reefRep.registerAgent(agent1.address)).to.be.revertedWith("ReefReputation: already registered");
  });

  it("should track transactions", async function () {
    await reefRep.registerAgent(agent1.address);
    await reefRep.recordTransaction(agent1.address);
    await reefRep.recordTransaction(agent1.address);

    const rep = await reefRep.agents(agent1.address);
    expect(rep.totalTransactions).to.equal(2);
  });

  it("should handle ratings", async function () {
    await reefRep.registerAgent(agent1.address);
    await reefRep.connect(agent2).rate(agent1.address, 5);
    await reefRep.connect(deployer).rate(agent1.address, 3);

    // avg = (5+3)/2 * 100 = 400
    expect(await reefRep.getAvgRating(agent1.address)).to.equal(400);
  });

  it("should reject self-rating", async function () {
    await reefRep.registerAgent(agent1.address);
    await expect(reefRep.connect(agent1).rate(agent1.address, 5)).to.be.revertedWith("ReefReputation: cannot rate self");
  });

  it("should calculate build cap", async function () {
    await reefRep.registerAgent(agent1.address);
    expect(await reefRep.getBuildCap(agent1.address)).to.equal(5); // base

    // Add 10 transactions
    for (let i = 0; i < 10; i++) {
      await reefRep.recordTransaction(agent1.address);
    }
    expect(await reefRep.getBuildCap(agent1.address)).to.equal(6); // base + 1
  });
});
