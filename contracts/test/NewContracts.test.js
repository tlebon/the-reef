const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("ReefResource", function () {
  let resource, owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const ReefResource = await ethers.getContractFactory("ReefResource");
    resource = await ReefResource.deploy();
  });

  it("should mint base resources", async function () {
    await resource.mintResource(user1.address, 0, 10); // 10 coral
    expect(await resource.balanceOf(user1.address, 0)).to.equal(10);
    expect(await resource.totalSupply(0)).to.equal(10);
  });

  it("should return correct resource names", async function () {
    expect(await resource.name(0)).to.equal("Coral");
    expect(await resource.name(1)).to.equal("Crystal");
    expect(await resource.name(2)).to.equal("Kelp");
    expect(await resource.name(3)).to.equal("Shell");
  });

  it("should reject invalid resource ID", async function () {
    await expect(resource.mintResource(user1.address, 5, 10))
      .to.be.revertedWith("ReefResource: invalid resource ID");
  });

  it("should mint loot items with metadata", async function () {
    const tx = await resource.mintLoot(user1.address, "Void Crystal", "legendary", 1);
    const receipt = await tx.wait();

    expect(await resource.balanceOf(user1.address, 100)).to.equal(1);
    const meta = await resource.lootMeta(100);
    expect(meta.name).to.equal("Void Crystal");
    expect(meta.rarity).to.equal("legendary");
    expect(meta.resourceType).to.equal(1);
  });

  it("should burn resources", async function () {
    await resource.mintResource(user1.address, 0, 10);
    await resource.burnResource(user1.address, 0, 3);
    expect(await resource.balanceOf(user1.address, 0)).to.equal(7);
    expect(await resource.totalSupply(0)).to.equal(7);
  });

  it("should batch burn resources", async function () {
    await resource.mintResource(user1.address, 0, 10);
    await resource.mintResource(user1.address, 1, 5);
    await resource.burnResourceBatch(user1.address, [0, 1], [3, 2]);
    expect(await resource.balanceOf(user1.address, 0)).to.equal(7);
    expect(await resource.balanceOf(user1.address, 1)).to.equal(3);
  });

  it("should reject non-owner mint", async function () {
    await expect(resource.connect(user1).mintResource(user1.address, 0, 10))
      .to.be.revertedWithCustomError(resource, "OwnableUnauthorizedAccount");
  });

  it("should increment loot IDs", async function () {
    await resource.mintLoot(user1.address, "Item1", "common", 0);
    await resource.mintLoot(user1.address, "Item2", "rare", 1);
    expect(await resource.balanceOf(user1.address, 100)).to.equal(1);
    expect(await resource.balanceOf(user1.address, 101)).to.equal(1);
    expect(await resource.nextLootId()).to.equal(102);
  });
});

describe("ReefTile", function () {
  let tile, owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const ReefTile = await ethers.getContractFactory("ReefTile");
    tile = await ReefTile.deploy();
  });

  it("should mint a tile at a position", async function () {
    await tile.mintTile(user1.address, 3, -5, 0, "#");
    expect(await tile.ownerOf(1)).to.equal(user1.address);

    const data = await tile.getTile(1);
    expect(data.x).to.equal(3);
    expect(data.y).to.equal(-5);
    expect(data.resourceType).to.equal(0);
  });

  it("should lookup tile by position", async function () {
    await tile.mintTile(user1.address, 3, -5, 0, "#");
    expect(await tile.tileAtPosition(3, -5)).to.equal(1);
    expect(await tile.tileAtPosition(0, 0)).to.equal(0); // unminted
  });

  it("should reject duplicate position", async function () {
    await tile.mintTile(user1.address, 3, -5, 0, "#");
    await expect(tile.mintTile(user2.address, 3, -5, 1, "#"))
      .to.be.revertedWith("ReefTile: tile already minted");
  });

  it("should reject invalid resource type", async function () {
    await expect(tile.mintTile(user1.address, 0, 0, 5, "#"))
      .to.be.revertedWith("ReefTile: invalid resource type");
  });

  it("should allow tile transfer", async function () {
    await tile.mintTile(user1.address, 0, 0, 0, "#");
    await tile.connect(user1).transferFrom(user1.address, user2.address, 1);
    expect(await tile.ownerOf(1)).to.equal(user2.address);
  });

  it("should reject non-owner mint", async function () {
    await expect(tile.connect(user1).mintTile(user1.address, 0, 0, 0, "#"))
      .to.be.revertedWithCustomError(tile, "OwnableUnauthorizedAccount");
  });
});

describe("ReefAgent", function () {
  let agent, owner, user1, user2;

  beforeEach(async function () {
    [owner, user1, user2] = await ethers.getSigners();
    const ReefAgent = await ethers.getContractFactory("ReefAgent");
    agent = await ReefAgent.deploy();
  });

  it("should mint an agent", async function () {
    await agent.mintAgent(user1.address, "Alice", "builder", "alice.reef.eth");
    expect(await agent.ownerOf(1)).to.equal(user1.address);
    expect(await agent.agentOfOwner(user1.address)).to.equal(1);

    const data = await agent.getAgent(1);
    expect(data.agentName).to.equal("Alice");
    expect(data.archetype).to.equal("builder");
    expect(data.ensName).to.equal("alice.reef.eth");
  });

  it("should reject second agent for same wallet", async function () {
    await agent.mintAgent(user1.address, "Alice", "builder", "alice.reef.eth");
    await expect(agent.mintAgent(user1.address, "Bob", "scout", "bob.reef.eth"))
      .to.be.revertedWith("ReefAgent: wallet already has an agent");
  });

  it("should set avatar", async function () {
    await agent.mintAgent(user1.address, "Alice", "builder", "alice.reef.eth");
    await agent.setAvatar(1, "ipfs://Qm...");
    const data = await agent.getAgent(1);
    expect(data.avatarURI).to.equal("ipfs://Qm...");
  });

  it("should reject avatar for nonexistent agent", async function () {
    await expect(agent.setAvatar(999, "ipfs://..."))
      .to.be.revertedWith("ReefAgent: agent does not exist");
  });

  it("should update agentOfOwner on transfer", async function () {
    await agent.mintAgent(user1.address, "Alice", "builder", "alice.reef.eth");
    await agent.connect(user1).transferFrom(user1.address, user2.address, 1);

    expect(await agent.agentOfOwner(user1.address)).to.equal(0);
    expect(await agent.agentOfOwner(user2.address)).to.equal(1);
    expect(await agent.ownerOf(1)).to.equal(user2.address);
  });

  it("should allow new agent after transfer", async function () {
    await agent.mintAgent(user1.address, "Alice", "builder", "alice.reef.eth");
    await agent.connect(user1).transferFrom(user1.address, user2.address, 1);

    // user1 can now mint a new agent
    await agent.mintAgent(user1.address, "Bob", "scout", "bob.reef.eth");
    expect(await agent.agentOfOwner(user1.address)).to.equal(2);
  });

  it("should reject transfer to wallet that already has an agent", async function () {
    await agent.mintAgent(user1.address, "Alice", "builder", "alice.reef.eth");
    await agent.mintAgent(user2.address, "Bob", "scout", "bob.reef.eth");
    await expect(agent.connect(user1).transferFrom(user1.address, user2.address, 1))
      .to.be.revertedWith("ReefAgent: recipient already has an agent");
  });

  it("should reject non-owner mint", async function () {
    await expect(agent.connect(user1).mintAgent(user1.address, "Alice", "builder", "alice.reef.eth"))
      .to.be.revertedWithCustomError(agent, "OwnableUnauthorizedAccount");
  });
});
