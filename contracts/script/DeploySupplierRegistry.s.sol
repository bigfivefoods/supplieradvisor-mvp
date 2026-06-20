// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script} from "forge-std/Script.sol";
import {SupplierRegistry} from "../src/SupplierRegistry.sol";

contract DeploySupplierRegistry is Script {
    function run() external returns (SupplierRegistry) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address initialOwner = vm.envAddress("INITIAL_OWNER");

        vm.startBroadcast(deployerPrivateKey);
        SupplierRegistry registry = new SupplierRegistry(initialOwner);
        vm.stopBroadcast();

        return registry;
    }
}