// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Strings.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

/**
 * @title ReefAgent
 * @notice ERC-721 NFT representing an agent in The Reef.
 *         Stores avatar URI, archetype, and references to ENS + reputation.
 *         Tradeable — but reputation is soulbound (stays with the address).
 */
contract ReefAgent is ERC721, Ownable, ReentrancyGuard {
    using Strings for uint256;

    struct AgentData {
        string name;
        string archetype;
        string avatarURI;
        string ensName;
        address delegateWallet;
        uint256 mintedAt;
    }

    string public baseURI;
    uint256 public nextTokenId;
    mapping(uint256 => AgentData) public agents;
    mapping(address => uint256) public agentOfOwner;

    event DelegateUpdated(uint256 indexed tokenId, address delegate);

    event AgentMinted(address indexed owner, uint256 indexed tokenId, string name, string archetype);
    event AvatarUpdated(uint256 indexed tokenId, string avatarURI);

    constructor() ERC721("Reef Agent", "RAGENT") Ownable(msg.sender) {}

    function mintAgent(
        address to,
        string calldata agentName,
        string calldata archetype,
        string calldata ensName
    ) external onlyOwner returns (uint256) {
        require(agentOfOwner[to] == 0, "ReefAgent: wallet already has an agent");

        uint256 tokenId = ++nextTokenId;
        agents[tokenId] = AgentData(agentName, archetype, "", ensName, address(0), block.timestamp);

        _mint(to, tokenId);
        emit AgentMinted(to, tokenId, agentName, archetype);
        return tokenId;
    }

    /**
     * @notice Set delegate wallet — allows an AI agent to act on behalf of the owner.
     *         Only callable by the token owner.
     */
    function setDelegate(uint256 tokenId, address delegate) external {
        require(ownerOf(tokenId) == msg.sender, "ReefAgent: not token owner");
        agents[tokenId].delegateWallet = delegate;
        emit DelegateUpdated(tokenId, delegate);
    }

    function setAvatar(uint256 tokenId, string calldata avatarURI) external onlyOwner {
        require(agents[tokenId].mintedAt > 0, "ReefAgent: agent does not exist");
        agents[tokenId].avatarURI = avatarURI;
        emit AvatarUpdated(tokenId, avatarURI);
    }

    function setBaseURI(string calldata uri) external onlyOwner {
        baseURI = uri;
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        require(agents[tokenId].mintedAt > 0, "ReefAgent: agent does not exist");
        if (bytes(agents[tokenId].avatarURI).length > 0) {
            return agents[tokenId].avatarURI;
        }
        if (bytes(baseURI).length > 0) {
            return string(abi.encodePacked(baseURI, tokenId.toString()));
        }
        return "";
    }

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

    function _update(address to, uint256 tokenId, address auth) internal override nonReentrant returns (address) {
        // On transfer (not mint, not self-transfer): reject if recipient already has an agent
        address from = _ownerOf(tokenId);
        if (agents[tokenId].mintedAt > 0 && to != address(0) && from != to && agentOfOwner[to] != 0) {
            revert("ReefAgent: recipient already has an agent");
        }

        // Clear sender's mapping and delegate before external call
        if (from != address(0)) {
            agentOfOwner[from] = 0;
            agents[tokenId].delegateWallet = address(0); // reset delegate on transfer
        }

        address result = super._update(to, tokenId, auth);

        // Set receiver's mapping after transfer
        if (to != address(0)) {
            agentOfOwner[to] = tokenId;
        }

        return result;
    }
}
