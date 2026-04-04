// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title ReefAgent
 * @notice ERC-721 NFT representing an agent in The Reef.
 *         Stores avatar URI, archetype, and references to ENS + reputation.
 *         Tradeable — but reputation is soulbound (stays with the address).
 *
 *         For 0G prize: can be upgraded to ERC-7857 (iNFT) with encrypted
 *         metadata stored in 0G Storage.
 */
contract ReefAgent is ERC721, Ownable {
    struct AgentData {
        string name;
        string archetype;    // builder, merchant, scout, crafter
        string avatarURI;    // IPFS/0G Storage URI for avatar image
        string ensName;      // e.g. "alice.reef.eth"
        uint256 mintedAt;
    }

    uint256 public nextTokenId;
    mapping(uint256 => AgentData) public agents;
    mapping(address => uint256) public agentOfOwner; // one agent per wallet

    event AgentMinted(address indexed owner, uint256 indexed tokenId, string name, string archetype);
    event AvatarUpdated(uint256 indexed tokenId, string avatarURI);

    constructor() ERC721("Reef Agent", "RAGENT") Ownable(msg.sender) {}

    /**
     * @notice Mint an agent NFT.
     *         One agent per wallet address.
     */
    function mintAgent(
        address to,
        string calldata agentName,
        string calldata archetype,
        string calldata ensName
    ) external onlyOwner returns (uint256) {
        require(agentOfOwner[to] == 0, "ReefAgent: wallet already has an agent");

        uint256 tokenId = ++nextTokenId;
        agents[tokenId] = AgentData(agentName, archetype, "", ensName, block.timestamp);
        agentOfOwner[to] = tokenId;

        _mint(to, tokenId);
        emit AgentMinted(to, tokenId, agentName, archetype);
        return tokenId;
    }

    /**
     * @notice Set or update the avatar image URI.
     *         Only callable by the operator (for AI-generated avatars).
     */
    function setAvatar(uint256 tokenId, string calldata avatarURI) external onlyOwner {
        require(agents[tokenId].mintedAt > 0, "ReefAgent: agent does not exist");
        agents[tokenId].avatarURI = avatarURI;
        emit AvatarUpdated(tokenId, avatarURI);
    }

    /**
     * @notice Get agent data.
     */
    function getAgent(uint256 tokenId) external view returns (
        string memory agentName,
        string memory archetype,
        string memory avatarURI,
        string memory ensName,
        uint256 mintedAt
    ) {
        AgentData memory a = agents[tokenId];
        return (a.name, a.archetype, a.avatarURI, a.ensName, a.mintedAt);
    }

    /**
     * @notice Override transfer to update agentOfOwner mapping.
     */
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = super._update(to, tokenId, auth);
        if (from != address(0)) {
            agentOfOwner[from] = 0;
        }
        if (to != address(0)) {
            agentOfOwner[to] = tokenId;
        }
        return from;
    }
}
