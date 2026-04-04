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

  it("should burn loot items", async function () {
    await resource.mintLoot(user1.address, "Void Crystal", "legendary", 1);
    expect(await resource.balanceOf(user1.address, 100)).to.equal(1);
    await resource.burnLoot(user1.address, 100);
    expect(await resource.balanceOf(user1.address, 100)).to.equal(0);
  });

  it("should reject burning base resource as loot", async function () {
    await resource.mintResource(user1.address, 0, 10);
    await expect(resource.burnLoot(user1.address, 0))
      .to.be.revertedWith("ReefResource: not a loot item");
  });

  it("should reject burning nonexistent loot", async function () {
    await expect(resource.burnLoot(user1.address, 100))
      .to.be.revertedWith("ReefResource: loot does not exist");
  });

  it("should increment loot IDs", async function () {
    await resource.mintLoot(user1.address, "Item1", "common", 0);
    await resource.mintLoot(user1.address, "Item2", "rare", 1);
    expect(await resource.balanceOf(user1.address, 100)).to.equal(1);
    expect(await resource.balanceOf(user1.address, 101)).to.equal(1);
    expect(await resource.nextLootId()).to.equal(102);
  });

  it("should claim resources with server signature", async function () {
    const ids = [0, 1]; // coral, crystal
    const amounts = [10, 5];
    const nonce = 0;
    const deadline = Math.floor(Date.now() / 1000) + 3600; // 1 hour from now
    const chainId = (await ethers.provider.getNetwork()).chainId;
    const contractAddr = await resource.getAddress();

    const hash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256[]", "uint256[]", "uint256", "uint256", "uint256", "address"],
        [user1.address, ids, amounts, nonce, deadline, chainId, contractAddr]
      )
    );
    const signature = await owner.signMessage(ethers.getBytes(hash));

    await resource.connect(user1).claimResources(user1.address, ids, amounts, nonce, deadline, signature);

    expect(await resource.balanceOf(user1.address, 0)).to.equal(10);
    expect(await resource.balanceOf(user1.address, 1)).to.equal(5);
    expect(await resource.claimNonce(user1.address)).to.equal(1);
  });

  it("should reject claim with wrong nonce", async function () {
    const ids = [0];
    const amounts = [10];
    const wrongNonce = 99;
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const dummySig = "0x" + "00".repeat(65);

    await expect(resource.connect(user1).claimResources(user1.address, ids, amounts, wrongNonce, deadline, dummySig))
      .to.be.revertedWith("ReefResource: invalid nonce");
  });

  it("should reject claim for someone else", async function () {
    const deadline = Math.floor(Date.now() / 1000) + 3600;
    const dummySig = "0x" + "00".repeat(65);

    await expect(resource.connect(user2).claimResources(user1.address, [0], [10], 0, deadline, dummySig))
      .to.be.revertedWith("ReefResource: can only claim for yourself");
  });

  it("should reject claim with invalid signature", async function () {
    const ids = [0];
    const amounts = [10];
    const nonce = 0;
    const deadline = Math.floor(Date.now() / 1000) + 3600;

    // Sign with wrong signer (not owner)
    const hash = ethers.keccak256(
      ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "uint256[]", "uint256[]", "uint256", "uint256", "uint256", "address"],
        [user1.address, ids, amounts, nonce, deadline, (await ethers.provider.getNetwork()).chainId, await resource.getAddress()]
      )
    );
    const signature = await user2.signMessage(ethers.getBytes(hash));

    await expect(resource.connect(user1).claimResources(user1.address, ids, amounts, nonce, deadline, signature))
      .to.be.revertedWith("ReefResource: invalid signature");
  });

  it("should return loot name", async function () {
    await resource.mintLoot(user1.address, "Void Crystal", "legendary", 1);
    expect(await resource.name(100)).to.equal("Void Crystal");
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

  it("should store and return symbol", async function () {
    await tile.mintTile(user1.address, 5, 5, 2, "~");
    const data = await tile.getTile(1);
    expect(data.symbol).to.equal("~");
  });

  it("should return tokenURI with baseURI", async function () {
    await tile.mintTile(user1.address, 0, 0, 0, "#");
    await tile.setBaseURI("https://reef.game/tiles/");
    expect(await tile.tokenURI(1)).to.equal("https://reef.game/tiles/1");
  });

  it("should return empty tokenURI without baseURI", async function () {
    await tile.mintTile(user1.address, 0, 0, 0, "#");
    expect(await tile.tokenURI(1)).to.equal("");
  });

  it("should revert tokenURI for nonexistent tile", async function () {
    await expect(tile.tokenURI(999))
      .to.be.revertedWith("ReefTile: tile does not exist");
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

  it("should set and get delegate wallet", async function () {
    await agent.mintAgent(user1.address, "Alice", "builder", "alice.reef.eth");
    await agent.connect(user1).setDelegate(1, user2.address);
    const data = await agent.getAgent(1);
    expect(data.delegateWallet).to.equal(user2.address);
  });

  it("should reject setDelegate from non-owner of token", async function () {
    await agent.mintAgent(user1.address, "Alice", "builder", "alice.reef.eth");
    await expect(agent.connect(user2).setDelegate(1, user2.address))
      .to.be.revertedWith("ReefAgent: not token owner");
  });

  it("should clear delegate on transfer", async function () {
    await agent.mintAgent(user1.address, "Alice", "builder", "alice.reef.eth");
    await agent.connect(user1).setDelegate(1, user2.address);
    // Transfer to a fresh address (pending signer)
    const [,,, pending] = await ethers.getSigners();
    await agent.connect(user1).transferFrom(user1.address, pending.address, 1);
    const data = await agent.getAgent(1);
    expect(data.delegateWallet).to.equal(ethers.ZeroAddress);
  });

  it("should return tokenURI with avatar", async function () {
    await agent.mintAgent(user1.address, "Alice", "builder", "alice.reef.eth");
    await agent.setAvatar(1, "ipfs://QmAvatar");
    expect(await agent.tokenURI(1)).to.equal("ipfs://QmAvatar");
  });

  it("should return tokenURI with baseURI when no avatar", async function () {
    await agent.mintAgent(user1.address, "Alice", "builder", "alice.reef.eth");
    await agent.setBaseURI("https://reef.game/agents/");
    expect(await agent.tokenURI(1)).to.equal("https://reef.game/agents/1");
  });

  it("should revert tokenURI for nonexistent agent", async function () {
    await expect(agent.tokenURI(999))
      .to.be.revertedWith("ReefAgent: agent does not exist");
  });
});
