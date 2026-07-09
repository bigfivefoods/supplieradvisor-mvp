// SPDX-License-Identifier: MIT
pragma solidity ^0.8.26;

import {Script, console2} from "forge-std/Script.sol";
import {InventoryPassport} from "../src/InventoryPassport.sol";

contract DeployInventoryPassport is Script {
    function run() external returns (InventoryPassport) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address owner = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        InventoryPassport passport = new InventoryPassport(owner);
        vm.stopBroadcast();

        console2.log("InventoryPassport deployed at:", address(passport));
        console2.log("Owner / minter:", owner);
        return passport;
    }
}
