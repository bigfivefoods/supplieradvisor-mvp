// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/POEscrow.sol";

contract DeployPOEscrow is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        vm.startBroadcast(deployerPrivateKey);

        POEscrow poEscrow = new POEscrow();

        console.log("POEscrow deployed at:", address(poEscrow));

        vm.stopBroadcast();
    }
}