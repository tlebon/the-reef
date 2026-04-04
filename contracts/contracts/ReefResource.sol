// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC1155/ERC1155.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReefResource
 * @notice ERC-1155 multi-token for all Reef resources and loot items.
 *
 * Token IDs:
 *   0 = Coral
 *   1 = Crystal
 *   2 = Kelp
 *   3 = Shell
 *   100+ = Loot items (minted with rarity metadata)
 */
contract ReefResource is ERC1155, Ownable {
    uint256 public constant CORAL = 0;
    uint256 public constant CRYSTAL = 1;
    uint256 public constant KELP = 2;
    uint256 public constant SHELL = 3;

    uint256 public nextLootId = 100;

    // Loot item metadata
    struct LootMeta {
        string name;
        string rarity;  // common, uncommon, rare, legendary
        uint256 resourceType; // which base resource it's derived from
    }

    mapping(uint256 => LootMeta) public lootMeta;
    mapping(uint256 => uint256) private _totalSupply;

    event ResourceMinted(address indexed to, uint256 indexed tokenId, uint256 amount);
    event LootMinted(address indexed to, uint256 indexed tokenId, string name, string rarity);
    event ResourceBurned(address indexed from, uint256 indexed tokenId, uint256 amount);

    constructor() ERC1155("") Ownable(msg.sender) {}

    /**
     * @notice Get a human-readable name for a token ID.
     */
    function name(uint256 id) external view returns (string memory) {
        if (id == CORAL) return "Coral";
        if (id == CRYSTAL) return "Crystal";
        if (id == KELP) return "Kelp";
        if (id == SHELL) return "Shell";
        return lootMeta[id].name;
    }

    /**
     * @notice Mint base resources (coral, crystal, kelp, shell).
     *         Called by the server on scavenge or quest reward.
     */
    function mintResource(address to, uint256 resourceId, uint256 amount) external onlyOwner {
        require(resourceId <= SHELL, "ReefResource: invalid resource ID");
        _mint(to, resourceId, amount, "");
        _totalSupply[resourceId] += amount;
        emit ResourceMinted(to, resourceId, amount);
    }

    /**
     * @notice Mint a loot item with metadata.
     */
    function mintLoot(
        address to,
        string calldata lootName,
        string calldata rarity,
        uint256 resourceType
    ) external onlyOwner returns (uint256) {
        uint256 tokenId = nextLootId++;
        lootMeta[tokenId] = LootMeta(lootName, rarity, resourceType);
        _mint(to, tokenId, 1, "");
        _totalSupply[tokenId] = 1;
        emit LootMinted(to, tokenId, lootName, rarity);
        return tokenId;
    }

    /**
     * @notice Burn resources (used for tile minting costs).
     */
    function burnResource(address from, uint256 resourceId, uint256 amount) external onlyOwner {
        _burn(from, resourceId, amount);
        _totalSupply[resourceId] -= amount;
        emit ResourceBurned(from, resourceId, amount);
    }

    /**
     * @notice Batch burn multiple resources (tile minting costs multiple types).
     */
    function burnResourceBatch(
        address from,
        uint256[] calldata ids,
        uint256[] calldata amounts
    ) external onlyOwner {
        _burnBatch(from, ids, amounts);
        for (uint256 i = 0; i < ids.length; i++) {
            _totalSupply[ids[i]] -= amounts[i];
        }
    }

    /**
     * @notice Get total supply of a token.
     */
    function totalSupply(uint256 id) external view returns (uint256) {
        return _totalSupply[id];
    }
}
