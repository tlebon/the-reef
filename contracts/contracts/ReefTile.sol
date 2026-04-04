// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";

/**
 * @title ReefTile
 * @notice ERC-721 NFT for tile ownership in The Reef.
 *         Each tile is a unique position in the world grid.
 */
contract ReefTile is ERC721, Ownable {
    using Strings for uint256;

    struct TileData {
        int256 x;
        int256 y;
        uint8 resourceType; // 0=coral, 1=crystal, 2=kelp, 3=shell
        string symbol;      // map icon chosen by the builder
        uint256 mintedAt;
    }

    string public baseURI;
    uint256 public nextTokenId;
    mapping(uint256 => TileData) public tiles;
    mapping(bytes32 => uint256) public positionToToken;

    event TileMinted(address indexed owner, uint256 indexed tokenId, int256 x, int256 y, uint8 resourceType, string symbol);

    constructor() ERC721("Reef Tile", "RTILE") Ownable(msg.sender) {}

    function mintTile(
        address to,
        int256 x,
        int256 y,
        uint8 resourceType,
        string calldata symbol
    ) external onlyOwner returns (uint256) {
        bytes32 posKey = keccak256(abi.encodePacked(x, y));
        require(positionToToken[posKey] == 0 || !_exists(positionToToken[posKey]), "ReefTile: tile already minted");
        require(resourceType <= 3, "ReefTile: invalid resource type");

        uint256 tokenId = ++nextTokenId;
        tiles[tokenId] = TileData(x, y, resourceType, symbol, block.timestamp);
        positionToToken[posKey] = tokenId;

        _mint(to, tokenId);
        emit TileMinted(to, tokenId, x, y, resourceType, symbol);
        return tokenId;
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        baseURI = uri;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(_exists(tokenId), "ReefTile: tile does not exist");
        if (bytes(baseURI).length > 0) {
            return string(abi.encodePacked(baseURI, tokenId.toString()));
        }
        return "";
    }

    function tileAtPosition(int256 x, int256 y) external view returns (uint256) {
        return positionToToken[keccak256(abi.encodePacked(x, y))];
    }

    function _exists(uint256 tokenId) internal view returns (bool) {
        return tiles[tokenId].mintedAt > 0;
    }

    function getTile(uint256 tokenId) external view returns (int256 x, int256 y, uint8 resourceType, string memory symbol, uint256 mintedAt) {
        TileData memory t = tiles[tokenId];
        return (t.x, t.y, t.resourceType, t.symbol, t.mintedAt);
    }
}
