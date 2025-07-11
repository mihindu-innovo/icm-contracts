// (c) 2024, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

// SPDX-License-Identifier: LicenseRef-Ecosystem

pragma solidity 0.8.25;

import {ERC20TokenHomeERC2771Recipient} from "../TokenHome/ERC20TokenHomeERC2771Recipient.sol";
import {ERC20TokenRemoteERC2771Recipient} from "../TokenRemote/ERC20TokenRemoteERC2771Recipient.sol";

/**
 * @title ERC2771RecipientExample
 * @notice Example deployment contract for ERC2771Recipient ICTT contracts
 * @dev This example shows how to deploy and initialize ICTT contracts with ERC2771Recipient support
 */
contract ERC2771RecipientExample {
    
    /**
     * @notice Deploy and initialize ERC20TokenHomeERC2771Recipient
     * @param teleporterRegistryAddress The Teleporter registry address
     * @param teleporterManager Address managing Teleporter integration
     * @param minTeleporterVersion Minimum Teleporter version
     * @param tokenAddress The ERC20 token contract address
     * @param tokenDecimals Number of decimals for the token
     * @param trustedForwarder Your Ava Cloud relayer address
     * @return The deployed home contract
     */
    function deployHome(
        address teleporterRegistryAddress,
        address teleporterManager,
        uint256 minTeleporterVersion,
        address tokenAddress,
        uint8 tokenDecimals,
        address trustedForwarder
    ) external returns (ERC20TokenHomeERC2771Recipient) {
        
        ERC20TokenHomeERC2771Recipient homeContract = new ERC20TokenHomeERC2771Recipient(
            teleporterRegistryAddress,
            teleporterManager,
            minTeleporterVersion,
            tokenAddress,
            tokenDecimals,
            trustedForwarder
        );
        
        return homeContract;
    }
    
    /**
     * @notice Deploy and initialize ERC20TokenRemoteERC2771Recipient
     * @param teleporterRegistryAddress The Teleporter registry address
     * @param teleporterManager Address managing Teleporter integration
     * @param minTeleporterVersion Minimum Teleporter version
     * @param tokenHomeBlockchainID The blockchain ID of the home contract
     * @param tokenHomeAddress The address of the home contract
     * @param tokenDecimals Number of decimals for the token
     * @param tokenName Name of the token
     * @param tokenSymbol Symbol of the token
     * @param trustedForwarder Your Ava Cloud relayer address
     * @return The deployed remote contract
     */
    function deployRemote(
        address teleporterRegistryAddress,
        address teleporterManager,
        uint256 minTeleporterVersion,
        bytes32 tokenHomeBlockchainID,
        address tokenHomeAddress,
        uint8 tokenDecimals,
        string memory tokenName,
        string memory tokenSymbol,
        address trustedForwarder
    ) external returns (ERC20TokenRemoteERC2771Recipient) {
        
        ERC20TokenRemoteERC2771Recipient remoteContract = new ERC20TokenRemoteERC2771Recipient(
            teleporterRegistryAddress,
            teleporterManager,
            minTeleporterVersion,
            tokenHomeBlockchainID,
            tokenHomeAddress,
            tokenDecimals,
            tokenName,
            tokenSymbol,
            trustedForwarder
        );
        
        return remoteContract;
    }
    
    /**
     * @notice Example of how to update trusted forwarder (owner only)
     * @param homeContract The home contract instance
     * @param remoteContract The remote contract instance
     * @param newTrustedForwarder The new trusted forwarder address
     */
    function updateTrustedForwarder(
        ERC20TokenHomeERC2771Recipient homeContract,
        ERC20TokenRemoteERC2771Recipient remoteContract,
        address newTrustedForwarder
    ) external {
        // Only contract owner can call these functions
        homeContract.setTrustedForwarder(newTrustedForwarder);
        remoteContract.setTrustedForwarder(newTrustedForwarder);
    }
    
    /**
     * @notice Example of how to check current trusted forwarder
     * @param homeContract The home contract instance
     * @return The current trusted forwarder address
     */
    function getTrustedForwarder(
        ERC20TokenHomeERC2771Recipient homeContract
    ) external view returns (address) {
        return homeContract.getTrustedForwarder();
    }
}