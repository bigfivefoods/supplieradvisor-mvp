// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Ownable} from "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title InventoryPassport
 * @notice Anchors product identity hashes and stock-movement hashes on-chain
 *         for SupplierAdvisor inventory passports (QR → public_id → bytes32).
 * @dev Deploy on Base / Base Sepolia. Off-chain system stores product_id mapping.
 */
contract InventoryPassport is Ownable {
    struct ProductAnchor {
        bytes32 identityHash;
        address company;
        string publicId;
        uint64 tokenId;
        uint64 anchoredAt;
        bool exists;
    }

    struct MovementAnchor {
        bytes32 movementHash;
        bytes32 productIdentityHash;
        address company;
        int128 quantity; // signed for issue/receive
        uint64 anchoredAt;
        bool exists;
    }

    uint64 public nextTokenId = 1;

    mapping(bytes32 => ProductAnchor) private _products; // identityHash => anchor
    mapping(string => bytes32) public publicIdToHash;
    mapping(bytes32 => MovementAnchor) private _movements; // movementHash => anchor
    mapping(address => bool) public minters;

    event MinterUpdated(address indexed minter, bool allowed);
    event ProductAnchored(
        bytes32 indexed identityHash,
        address indexed company,
        string publicId,
        uint64 tokenId,
        uint64 timestamp
    );
    event MovementAnchored(
        bytes32 indexed movementHash,
        bytes32 indexed productIdentityHash,
        address indexed company,
        int128 quantity,
        uint64 timestamp
    );

    constructor(address initialOwner) Ownable(initialOwner) {
        minters[initialOwner] = true;
    }

    modifier onlyMinter() {
        require(minters[msg.sender] || msg.sender == owner(), "Not minter");
        _;
    }

    function setMinter(address minter, bool allowed) external onlyOwner {
        minters[minter] = allowed;
        emit MinterUpdated(minter, allowed);
    }

    /**
     * @notice Anchor a product identity hash (SHA-256 of off-chain product passport).
     * @param identityHash 32-byte product hash
     * @param company Company wallet or operator
     * @param publicId Off-chain public UUID used in QR codes
     */
    function anchorProduct(
        bytes32 identityHash,
        address company,
        string calldata publicId
    ) external onlyMinter returns (uint64 tokenId) {
        require(identityHash != bytes32(0), "Empty hash");
        require(bytes(publicId).length > 0, "Empty publicId");
        require(!_products[identityHash].exists, "Already anchored");
        require(publicIdToHash[publicId] == bytes32(0), "publicId used");

        tokenId = nextTokenId++;
        _products[identityHash] = ProductAnchor({
            identityHash: identityHash,
            company: company,
            publicId: publicId,
            tokenId: tokenId,
            anchoredAt: uint64(block.timestamp),
            exists: true
        });
        publicIdToHash[publicId] = identityHash;

        emit ProductAnchored(identityHash, company, publicId, tokenId, uint64(block.timestamp));
    }

    function anchorMovement(
        bytes32 movementHash,
        bytes32 productIdentityHash,
        address company,
        int128 quantity
    ) external onlyMinter {
        require(movementHash != bytes32(0), "Empty movement hash");
        require(!_movements[movementHash].exists, "Movement exists");
        require(_products[productIdentityHash].exists, "Product not anchored");

        _movements[movementHash] = MovementAnchor({
            movementHash: movementHash,
            productIdentityHash: productIdentityHash,
            company: company,
            quantity: quantity,
            anchoredAt: uint64(block.timestamp),
            exists: true
        });

        emit MovementAnchored(
            movementHash,
            productIdentityHash,
            company,
            quantity,
            uint64(block.timestamp)
        );
    }

    function getProduct(bytes32 identityHash) external view returns (ProductAnchor memory) {
        return _products[identityHash];
    }

    function getMovement(bytes32 movementHash) external view returns (MovementAnchor memory) {
        return _movements[movementHash];
    }

    function isProductAnchored(bytes32 identityHash) external view returns (bool) {
        return _products[identityHash].exists;
    }
}
