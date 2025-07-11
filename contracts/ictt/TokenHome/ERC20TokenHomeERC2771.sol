// (c) 2024, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

// SPDX-License-Identifier: LicenseRef-Ecosystem

pragma solidity 0.8.25;

import {ERC20TokenHomeUpgradeableERC2771} from "./ERC20TokenHomeUpgradeableERC2771.sol";
import {ICMInitializable} from "@utilities/ICMInitializable.sol";

/**
 * @title ERC20TokenHomeERC2771
 * @notice A non-upgradeable version of {ERC20TokenHomeUpgradeableERC2771} that calls the parent upgradeable contract's initialize function.
 * This version supports ERC-2771 meta-transactions through trusted forwarders for gasless transactions.
 * @custom:security-contact https://github.com/ava-labs/icm-contracts/blob/main/SECURITY.md
 */
contract ERC20TokenHomeERC2771 is ERC20TokenHomeUpgradeableERC2771 {
    constructor(
        address teleporterRegistryAddress,
        address teleporterManager,
        uint256 minTeleporterVersion,
        address tokenAddress,
        uint8 tokenDecimals,
        address trustedForwarder
    ) ERC20TokenHomeUpgradeableERC2771(ICMInitializable.Allowed) {
        initialize(
            teleporterRegistryAddress,
            teleporterManager,
            minTeleporterVersion,
            tokenAddress,
            tokenDecimals,
            trustedForwarder
        );
    }
}