import { parseAbi } from 'viem';

/**
 * SupplierRegistry Contract ABI
 * Used for on-chain supplier verification and reputation
 */
export const SupplierRegistryABI = parseAbi([
  // Write functions
  'function registerSupplier(string tradingName, string legalName, string category) external',
  'function submitVerification(bytes32 verificationHash) external',
  
  // Read functions
  'function isVerified(address wallet) external view returns (bool)',
  'function getReputation(address wallet) external view returns (uint256)',
  
  // Events
  'event SupplierRegistered(address indexed wallet, string tradingName, string category, uint256 timestamp)',
]);

export default SupplierRegistryABI;