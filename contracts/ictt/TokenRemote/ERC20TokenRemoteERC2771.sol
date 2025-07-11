// (c) 2024, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

// SPDX-License-Identifier: LicenseRef-Ecosystem

pragma solidity 0.8.25;

import {ERC20TokenRemoteUpgradeableERC2771} from "./ERC20TokenRemoteUpgradeableERC2771.sol";
import {TokenRemoteSettings} from "./interfaces/ITokenRemote.sol";
import {ICMInitializable} from "@utilities/ICMInitializable.sol";

/**
 * @title ERC20TokenRemoteERC2771
 * @notice A non-upgradeable version of {ERC20TokenRemoteUpgradeableERC2771} that calls the parent upgradeable contract's initialize function.
 * This version supports ERC-2771 meta-transactions through trusted forwarders for gasless transactions.
 * @custom:security-contact https://github.com/ava-labs/icm-contracts/blob/main/SECURITY.md
 */
contract ERC20TokenRemoteERC2771 is ERC20TokenRemoteUpgradeableERC2771 {
    constructor(
        TokenRemoteSettings memory settings,
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        address trustedForwarder
    ) ERC20TokenRemoteUpgradeableERC2771(ICMInitializable.Allowed) {
        initialize(settings, tokenName, tokenSymbol, tokenDecimals, trustedForwarder);
    }
}