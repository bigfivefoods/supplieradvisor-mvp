import { readFileSync } from 'fs';
import { join } from 'path';

const abiCache = new Map<string, any>();

export function loadAbi(contractName: string) {
  // Return from cache if already loaded
  if (abiCache.has(contractName)) {
    return abiCache.get(contractName);
  }

  try {
    const filePath = join(
      process.cwd(),
      'contracts',
      'out',
      `${contractName}.sol`,
      `${contractName}.json`
    );

    const fileContent = readFileSync(filePath, 'utf-8');
    const json = JSON.parse(fileContent);

    if (!json.abi) {
      throw new Error(`ABI not found in ${contractName}.json`);
    }

    // Cache it
    abiCache.set(contractName, json.abi);
    return json.abi;

  } catch (error: any) {
    console.error(`Failed to load ABI for ${contractName}:`, error.message);
    throw new Error(
      `Could not load ABI for contract "${contractName}". ` +
      `Make sure you ran "forge build" and the file exists in contracts/out/`
    );
  }
}