// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReefTile
 * @notice ERC-721 NFT for tile ownership in The Reef.
 *         Each tile is a unique position in the world grid.
 */
contract ReefTile is ERC721, Ownable {
    struct TileData {
        int256 x;
        int256 y;
        uint8 resourceType; // 0=coral, 1=crystal, 2=kelp, 3=shell
        uint256 mintedAt;
    }

    uint256 public nextTokenId;
    mapping(uint256 => TileData) public tiles;
    mapping(bytes32 => uint256) public positionToToken; // keccak256(x,y) -> tokenId

    event TileMinted(address indexed owner, uint256 indexed tokenId, int256 x, int256 y, uint8 resourceType);

    constructor() ERC721("Reef Tile", "RTILE") Ownable(msg.sender) {}

    /**
     * @notice Mint a tile NFT at a specific position.
     *         Only callable by the operator (server).
     */
    function mintTile(
        address to,
        int256 x,
        int256 y,
        uint8 resourceType
    ) external onlyOwner returns (uint256) {
        bytes32 posKey = keccak256(abi.encodePacked(x, y));
        require(positionToToken[posKey] == 0 || !_exists(positionToToken[posKey]), "ReefTile: tile already minted");
        require(resourceType <= 3, "ReefTile: invalid resource type");

        uint256 tokenId = ++nextTokenId; // start at 1 so 0 means unminted
        tiles[tokenId] = TileData(x, y, resourceType, block.timestamp);
        positionToToken[posKey] = tokenId;

        _mint(to, tokenId);
        emit TileMinted(to, tokenId, x, y, resourceType);
        return tokenId;
    }

    /**
     * @notice Check if a tile exists at a position.
     */
    function tileAtPosition(int256 x, int256 y) external view returns (uint256) {
        return positionToToken[keccak256(abi.encodePacked(x, y))];
    }

    /**
     * @notice Check if a token exists.
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return tiles[tokenId].mintedAt > 0;
    }

    /**
     * @notice Get tile data.
     */
    function getTile(uint256 tokenId) external view returns (int256 x, int256 y, uint8 resourceType, uint256 mintedAt) {
        TileData memory t = tiles[tokenId];
        return (t.x, t.y, t.resourceType, t.mintedAt);
    }
}
