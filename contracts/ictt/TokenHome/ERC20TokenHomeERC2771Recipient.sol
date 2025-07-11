// (c) 2024, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

// SPDX-License-Identifier: LicenseRef-Ecosystem

pragma solidity 0.8.25;

import {ERC20TokenHomeUpgradeable} from "./ERC20TokenHomeUpgradeable.sol";
import {ICMInitializable} from "@utilities/ICMInitializable.sol";
import {ERC2771Recipient} from "@openzeppelin/contracts@5.0.2/metatx/ERC2771Recipient.sol";
import {Context} from "@openzeppelin/contracts@5.0.2/utils/Context.sol";

/**
 * @title ERC20TokenHomeERC2771Recipient
 * @notice ERC20TokenHome with ERC2771Recipient support for meta-transactions.
 * This version follows the same pattern as other contracts in the system that use ERC2771Recipient.
 * @custom:security-contact https://github.com/ava-labs/icm-contracts/blob/main/SECURITY.md
 */
contract ERC20TokenHomeERC2771Recipient is ERC20TokenHomeUpgradeable, ERC2771Recipient {

    constructor(
        address teleporterRegistryAddress,
        address teleporterManager,
        uint256 minTeleporterVersion,
        address tokenAddress,
        uint8 tokenDecimals,
        address trustedForwarder
    ) ERC20TokenHomeUpgradeable(ICMInitializable.Allowed) {
        initialize(
            teleporterRegistryAddress,
            teleporterManager,
            minTeleporterVersion,
            tokenAddress,
            tokenDecimals,
            trustedForwarder
        );
    }

    /**
     * @notice Initializes the token TokenHome instance with ERC2771 support
     * @param teleporterRegistryAddress The current blockchain ID's Teleporter registry address
     * @param teleporterManager Address that manages this contract's integration with the Teleporter registry
     * @param minTeleporterVersion Minimum Teleporter version supported by this contract
     * @param tokenAddress The ERC20 token contract address to be transferred by the home
     * @param tokenDecimals The number of decimals for the ERC20 token
     * @param trustedForwarder The address of the trusted forwarder for meta-transactions
     */
    function initialize(
        address teleporterRegistryAddress,
        address teleporterManager,
        uint256 minTeleporterVersion,
        address tokenAddress,
        uint8 tokenDecimals,
        address trustedForwarder
    ) public initializer {
        // Initialize the parent ERC20TokenHome
        ERC20TokenHomeUpgradeable.initialize(
            teleporterRegistryAddress,
            teleporterManager,
            minTeleporterVersion,
            tokenAddress,
            tokenDecimals
        );
        
        // Set the trusted forwarder for meta-transactions
        _setTrustedForwarder(trustedForwarder);
    }

    /**
     * @dev Override _msgSender to support ERC2771 meta-transactions
     * This ensures that when a transaction comes through the trusted forwarder,
     * _msgSender() returns the original sender rather than the forwarder address
     */
    function _msgSender() internal view override(Context, ERC2771Recipient) returns (address) {
        return ERC2771Recipient._msgSender();
    }

    /**
     * @dev Override _msgData to support ERC2771 meta-transactions
     */
    function _msgData() internal view override(Context, ERC2771Recipient) returns (bytes calldata) {
        return ERC2771Recipient._msgData();
    }

    /**
     * @dev Override _contextSuffixLength to support ERC2771 meta-transactions
     */
    function _contextSuffixLength() internal view override(Context, ERC2771Recipient) returns (uint256) {
        return ERC2771Recipient._contextSuffixLength();
    }

    /**
     * @notice Update the trusted forwarder address
     * @param forwarder The new trusted forwarder address
     * @dev Only the owner can update the trusted forwarder
     */
    function setTrustedForwarder(address forwarder) external onlyOwner {
        _setTrustedForwarder(forwarder);
    }

    /**
     * @notice Get the current trusted forwarder address
     * @return The address of the trusted forwarder
     */
    function getTrustedForwarder() external view returns (address) {
        return trustedForwarder();
    }
}