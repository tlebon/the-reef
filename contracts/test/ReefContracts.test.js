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

  it("should reject verifyTick for non-existent tick", async function () {
    const hash = ethers.keccak256(ethers.toUtf8Bytes("state"));
    await expect(reefWorld.verifyTick(1, hash)).to.be.revertedWith("ReefWorld: tick does not exist");
  });

  it("should return false for wrong hash on verifyTick", async function () {
    const hash1 = ethers.keccak256(ethers.toUtf8Bytes("state1"));
    const hash2 = ethers.keccak256(ethers.toUtf8Bytes("wrong"));
    await reefWorld.commitTick(1, hash1);
    expect(await reefWorld.verifyTick(1, hash2)).to.be.false;
  });

  it("should transfer operator and emit event", async function () {
    await expect(reefWorld.transferOperator(other.address))
      .to.emit(reefWorld, "OperatorTransferred")
      .withArgs(operator.address, other.address);

    // New operator can commit
    const hash = ethers.keccak256(ethers.toUtf8Bytes("state"));
    await reefWorld.connect(other).commitTick(1, hash);

    // Old operator cannot
    await expect(reefWorld.commitTick(2, hash)).to.be.revertedWith("ReefWorld: not operator");
  });

  it("should reject transfer to zero address", async function () {
    await expect(reefWorld.transferOperator(ethers.ZeroAddress)).to.be.revertedWith("ReefWorld: zero address");
  });
});

describe("ReefReputation", function () {
  let reefRep, operator, agent1, agent2, rando;

  beforeEach(async function () {
    [operator, agent1, agent2, rando] = await ethers.getSigners();
    const ReefReputation = await ethers.getContractFactory("ReefReputation");
    reefRep = await ReefReputation.deploy();
  });

  it("should register agents (operator only)", async function () {
    await reefRep.registerAgent(agent1.address);
    expect(await reefRep.agentCount()).to.equal(1);
  });

  it("should reject non-operator registration", async function () {
    await expect(reefRep.connect(rando).registerAgent(agent1.address))
      .to.be.revertedWith("ReefReputation: not operator");
  });

  it("should reject duplicate registration", async function () {
    await reefRep.registerAgent(agent1.address);
    await expect(reefRep.registerAgent(agent1.address)).to.be.revertedWith("ReefReputation: already registered");
  });

  it("should track transactions (operator only)", async function () {
    await reefRep.registerAgent(agent1.address);
    await reefRep.recordTransaction(agent1.address);
    await reefRep.recordTransaction(agent1.address);

    const rep = await reefRep.agents(agent1.address);
    expect(rep.totalTransactions).to.equal(2);
  });

  it("should reject non-operator recordTransaction", async function () {
    await reefRep.registerAgent(agent1.address);
    await expect(reefRep.connect(rando).recordTransaction(agent1.address))
      .to.be.revertedWith("ReefReputation: not operator");
  });

  it("should reject recordTransaction for unregistered agent", async function () {
    await expect(reefRep.recordTransaction(agent1.address))
      .to.be.revertedWith("ReefReputation: agent not registered");
  });

  it("should handle ratings", async function () {
    await reefRep.registerAgent(agent1.address);
    await reefRep.connect(agent2).rate(agent1.address, 5);
    await reefRep.connect(rando).rate(agent1.address, 3);

    // avg = (5+3)/2 * 100 = 400
    expect(await reefRep.getAvgRating(agent1.address)).to.equal(400);
  });

  it("should reject self-rating", async function () {
    await reefRep.registerAgent(agent1.address);
    await expect(reefRep.connect(agent1).rate(agent1.address, 5))
      .to.be.revertedWith("ReefReputation: cannot rate self");
  });

  it("should reject duplicate rating from same rater", async function () {
    await reefRep.registerAgent(agent1.address);
    await reefRep.connect(agent2).rate(agent1.address, 4);
    await expect(reefRep.connect(agent2).rate(agent1.address, 5))
      .to.be.revertedWith("ReefReputation: already rated this agent");
  });

  it("should reject rating for unregistered agent", async function () {
    await expect(reefRep.connect(agent2).rate(agent1.address, 3))
      .to.be.revertedWith("ReefReputation: agent not registered");
  });

  it("should reject out-of-range scores", async function () {
    await reefRep.registerAgent(agent1.address);
    await expect(reefRep.connect(agent2).rate(agent1.address, 0))
      .to.be.revertedWith("ReefReputation: score must be 1-5");
    await expect(reefRep.connect(agent2).rate(agent1.address, 6))
      .to.be.revertedWith("ReefReputation: score must be 1-5");
  });

  it("should revert getAvgRating for unregistered agent", async function () {
    await expect(reefRep.getAvgRating(agent1.address))
      .to.be.revertedWith("ReefReputation: agent not registered");
  });

  it("should return 0 avg rating for agent with no ratings", async function () {
    await reefRep.registerAgent(agent1.address);
    expect(await reefRep.getAvgRating(agent1.address)).to.equal(0);
  });

  it("should calculate build cap", async function () {
    await reefRep.registerAgent(agent1.address);
    expect(await reefRep.getBuildCap(agent1.address)).to.equal(5); // base

    for (let i = 0; i < 10; i++) {
      await reefRep.recordTransaction(agent1.address);
    }
    expect(await reefRep.getBuildCap(agent1.address)).to.equal(6); // base + 1
  });

  it("should revert getBuildCap for unregistered agent", async function () {
    await expect(reefRep.getBuildCap(agent1.address))
      .to.be.revertedWith("ReefReputation: agent not registered");
  });
});
