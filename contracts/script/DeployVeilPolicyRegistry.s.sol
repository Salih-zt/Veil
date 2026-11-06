// SPDX-License-Identifier: MIT
pragma solidity 0.8.28;

import {Script} from "forge-std/Script.sol";
import {console} from "forge-std/console.sol";
import {VeilPolicyRegistry} from "../src/VeilPolicyRegistry.sol";

contract DeployVeilPolicyRegistry is Script {
    function run() external returns (VeilPolicyRegistry registry) {
        uint256 deployerPrivateKey = vm.envOr(
            "DEPLOYER_PRIVATE_KEY",
            uint256(0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80) // Anvil default account #0
        );

        vm.startBroadcast(deployerPrivateKey);

        registry = new VeilPolicyRegistry();
        console.log("VeilPolicyRegistry deployed at:", address(registry));

        vm.stopBroadcast();
    }
}
