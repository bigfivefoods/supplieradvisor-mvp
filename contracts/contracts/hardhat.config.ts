import hardhatToolboxViemPlugin from "@nomicfoundation/hardhat-toolbox-viem";
import hardhatVerifyPlugin from "@nomicfoundation/hardhat-verify";
import * as dotenv from "dotenv";

dotenv.config();

export default {
  plugins: [hardhatToolboxViemPlugin, hardhatVerifyPlugin],
  solidity: {
    version: "0.8.28",
  },
  networks: {
    sepolia: {
      type: "http",
      url: process.env.SEPOLIA_RPC_URL || "",
      accounts: process.env.SEPOLIA_PRIVATE_KEY
        ? [process.env.SEPOLIA_PRIVATE_KEY]
        : [],
    },
    baseSepolia: {
      type: "http",
      url:
        process.env.BASE_SEPOLIA_RPC_URL ||
        process.env.NEXT_PUBLIC_BASE_SEPOLIA_RPC ||
        "https://sepolia.base.org",
      accounts:
        process.env.SEPOLIA_PRIVATE_KEY || process.env.PRIVATE_KEY
          ? [process.env.SEPOLIA_PRIVATE_KEY || process.env.PRIVATE_KEY!]
          : [],
    },
  },
  verify: {
    etherscan: {
      apiKey: process.env.ETHERSCAN_API_KEY!,
    },
  },
};
