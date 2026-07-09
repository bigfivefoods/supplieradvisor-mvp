import { parseAbi } from 'viem';

export const InventoryPassportABI = parseAbi([
  'function anchorProduct(bytes32 identityHash, address company, string publicId) external returns (uint64 tokenId)',
  'function anchorMovement(bytes32 movementHash, bytes32 productIdentityHash, address company, int128 quantity) external',
  'function getProduct(bytes32 identityHash) external view returns ((bytes32 identityHash, address company, string publicId, uint64 tokenId, uint64 anchoredAt, bool exists))',
  'function isProductAnchored(bytes32 identityHash) external view returns (bool)',
  'function publicIdToHash(string publicId) external view returns (bytes32)',
  'function setMinter(address minter, bool allowed) external',
  'function minters(address) external view returns (bool)',
  'event ProductAnchored(bytes32 indexed identityHash, address indexed company, string publicId, uint64 tokenId, uint64 timestamp)',
  'event MovementAnchored(bytes32 indexed movementHash, bytes32 indexed productIdentityHash, address indexed company, int128 quantity, uint64 timestamp)',
]);

export default InventoryPassportABI;
