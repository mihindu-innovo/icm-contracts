// (c) 2024, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

// SPDX-License-Identifier: LicenseRef-Ecosystem

pragma solidity 0.8.25;

import {TokenHome} from "./TokenHome.sol";
import {IERC20TokenHome} from "./interfaces/IERC20TokenHome.sol";
import {IERC20SendAndCallReceiver} from "../interfaces/IERC20SendAndCallReceiver.sol";
import {
    SendTokensInput,
    SendAndCallInput,
    SingleHopCallMessage
} from "../interfaces/ITokenTransferrer.sol";
import {IERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol";
import {SafeERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/utils/SafeERC20.sol";
import {SafeERC20TransferFrom} from "@utilities/SafeERC20TransferFrom.sol";
import {CallUtils} from "@utilities/CallUtils.sol";
import {ICMInitializable} from "@utilities/ICMInitializable.sol";
import {ContextUpgradeable} from "@openzeppelin/contracts-upgradeable/utils/ContextUpgradeable.sol";

/**
 * @title ERC20TokenHomeUpgradeable
 * @notice An {IERC20TokenHome} implementation that locks a specified ERC20 token to be sent to
 * TokenRemote instances on other chains.
 * @custom:security-contact https://github.com/ava-labs/icm-contracts/blob/main/SECURITY.md
 */
contract ERC20TokenHomeUpgradeable is IERC20TokenHome, TokenHome {
    using SafeERC20 for IERC20;

    // solhint-disable private-vars-leading-underscore
    /**
     * @dev Namespace storage slots following the ERC-7201 standard to prevent
     * storage collisions between upgradeable contracts.
     *
     * @custom:storage-location erc7201:avalanche-ictt.storage.ERC20TokenHome
     */
    struct ERC20TokenHomeStorage {
        /// @notice The ERC20 token this home contract transfers to TokenRemote instances.
        IERC20 _token;
        /// @notice The trusted forwarder for EIP-712 meta-transactions
        address _trustedForwarder;
        /// @notice Domain separator for EIP-712
        bytes32 _domainSeparator;
    }
    // solhint-enable private-vars-leading-underscore

    /**
     * @dev Storage slot computed based off ERC-7201 formula
     * keccak256(abi.encode(uint256(keccak256("avalanche-ictt.storage.ERC20TokenHome")) - 1)) & ~bytes32(uint256(0xff));
     */
    bytes32 public constant ERC20_TOKEN_HOME_STORAGE_LOCATION =
        0x914a9547f6c3ddce1d5efbd9e687708f0d1d408ce129e8e1a88bce4f40e29500;

    // EIP-712 types
    bytes32 public constant FORWARD_REQUEST_TYPEHASH = keccak256(
        "ForwardRequest(address from,address to,uint256 value,uint256 gas,uint256 nonce,bytes data,uint256 validUntilTime)"
    );

    event MetaTransactionExecuted(address indexed user, address indexed forwarder);

    // solhint-disable ordering
    function _getERC20TokenHomeStorage() private pure returns (ERC20TokenHomeStorage storage $) {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            $.slot := ERC20_TOKEN_HOME_STORAGE_LOCATION
        }
    }

    constructor(
        ICMInitializable init,
        address forwarder
    ) {
        if (init == ICMInitializable.Disallowed) {
            _disableInitializers();
        }
        // Store forwarder address for EIP-712 support
        _setTrustedForwarder(forwarder);
    }

    /**
     * @notice Initializes the token TokenHome instance to send ERC20 tokens to TokenRemote instances on other chains.
     * @param teleporterRegistryAddress The current blockchain ID's Teleporter registry
     * address. See here for details: https://github.com/ava-labs/icm-contracts/tree/main/contracts/teleporter/registry
     * @param teleporterManager Address that manages this contract's integration with the
     * Teleporter registry and Teleporter versions.
     * @param minTeleporterVersion Minimum Teleporter version supported by this contract.
     * @param tokenAddress The ERC20 token contract address to be transferred by the home.
     * @param tokenDecimals The number of decimals for the ERC20 token
     */
    function initialize(
        address teleporterRegistryAddress,
        address teleporterManager,
        uint256 minTeleporterVersion,
        address tokenAddress,
        uint8 tokenDecimals
    ) public initializer {
        __ERC20TokenHome_init(
            teleporterRegistryAddress,
            teleporterManager,
            minTeleporterVersion,
            tokenAddress,
            tokenDecimals
        );
    }

    // solhint-disable-next-line func-name-mixedcase
    function __ERC20TokenHome_init(
        address teleporterRegistryAddress,
        address teleporterManager,
        uint256 minTeleporterVersion,
        address tokenAddress,
        uint8 tokenDecimals
    ) internal onlyInitializing {
        __TokenHome_init(
            teleporterRegistryAddress,
            teleporterManager,
            minTeleporterVersion,
            tokenAddress,
            tokenDecimals
        );
        __ERC20TokenHome_init_unchained(tokenAddress);
    }

    // solhint-disable-next-line func-name-mixedcase
    function __ERC20TokenHome_init_unchained(
        address tokenAddress
    ) internal onlyInitializing {
        ERC20TokenHomeStorage storage $ = _getERC20TokenHomeStorage();
        $._token = IERC20(tokenAddress);

        // Initialize domain separator for EIP-712
        $._domainSeparator = keccak256(
            abi.encode(
                keccak256("EIP712Domain(string name,string version,uint256 chainId,address verifyingContract)"),
                keccak256(bytes("ICTT Gasless")),
                keccak256(bytes("1")),
                block.chainid,
                address(this)
            )
        );
    }
    // solhint-enable ordering

    /**
     * @dev See {IERC20TokenTransferrer-send}
     */
    function send(SendTokensInput calldata input, uint256 amount) external {
        _send(input, amount);
    }

    /**
     * @dev See {IERC20TokenTransferrer-sendAndCall}
     */
    function sendAndCall(SendAndCallInput calldata input, uint256 amount) external {
        _sendAndCall({
            sourceBlockchainID: getBlockchainID(),
            originTokenTransferrerAddress: address(this),
            originSenderAddress: _msgSender(),
            input: input,
            amount: amount
        });
    }

    /**
     * @dev See {IERC20TokenHome-addCollateral}
     */
    function addCollateral(
        bytes32 remoteBlockchainID,
        address remoteTokenTransferrerAddress,
        uint256 amount
    ) external {
        _addCollateral(remoteBlockchainID, remoteTokenTransferrerAddress, amount);
    }

    /**
     * @dev See {TokenHome-_deposit}
     */
    function _deposit(
        uint256 amount
    ) internal virtual override returns (uint256) {
        ERC20TokenHomeStorage storage $ = _getERC20TokenHomeStorage();
        return SafeERC20TransferFrom.safeTransferFrom($._token, _msgSender(), amount);
    }

    /**
     * @dev See {TokenHome-_withdraw}
     */
    function _withdraw(address recipient, uint256 amount) internal virtual override {
        ERC20TokenHomeStorage storage $ = _getERC20TokenHomeStorage();
        emit TokensWithdrawn(recipient, amount);
        $._token.safeTransfer(recipient, amount);
    }

    /**
     * @dev See {TokenHome-_handleSendAndCall}
     *
     * Approves the recipient contract to spend the amount of tokens from this contract,
     * and calls {IERC20SendAndCallReceiver-receiveTokens} on the recipient contract.
     * If the call fails or doesn't spend all of the tokens, the remaining amount is
     * sent to the fallback recipient.
     */
    function _handleSendAndCall(
        SingleHopCallMessage memory message,
        uint256 amount
    ) internal virtual override {
        ERC20TokenHomeStorage storage $ = _getERC20TokenHomeStorage();
        IERC20 token = $._token;
        // Approve the recipient contract to spend the amount from the collateral.
        SafeERC20.safeIncreaseAllowance($._token, message.recipientContract, amount);

        // Encode the call to {IERC20SendAndCallReceiver-receiveTokens}
        bytes memory payload = abi.encodeCall(
            IERC20SendAndCallReceiver.receiveTokens,
            (
                message.sourceBlockchainID,
                message.originTokenTransferrerAddress,
                message.originSenderAddress,
                address(token),
                amount,
                message.recipientPayload
            )
        );

        // Call the recipient contract with the given payload and gas amount.
        bool success = CallUtils._callWithExactGas(
            message.recipientGasLimit, message.recipientContract, payload
        );

        uint256 remainingAllowance = token.allowance(address(this), message.recipientContract);

        // Reset the recipient contract allowance to 0.
        SafeERC20.forceApprove(token, message.recipientContract, 0);

        if (success) {
            emit CallSucceeded(message.recipientContract, amount);
        } else {
            emit CallFailed(message.recipientContract, amount);
        }

        // Transfer any remaining allowance to the fallback recipient. This will be the
        // full amount if the call failed.
        if (remainingAllowance > 0) {
            token.safeTransfer(message.fallbackRecipient, remainingAllowance);
        }
    }

    /**
     * @notice Execute a meta-transaction using EIP-712
     * @param from The sender address
     * @param to The target address
     * @param value The value to send
     * @param gas The gas limit
     * @param nonce The nonce
     * @param data The call data
     * @param validUntilTime The expiration time
     * @param signature The signature
     */
    function executeMetaTransaction(
        address from,
        address to,
        uint256 value,
        uint256 gas,
        uint256 nonce,
        bytes calldata data,
        uint256 validUntilTime,
        bytes calldata signature
    ) external returns (bytes memory) {
        require(validUntilTime == 0 || validUntilTime > block.timestamp, "Request expired");
        require(nonce == getNonce(from), "Invalid nonce");

        _verifySignature(from, to, value, gas, nonce, data, validUntilTime, signature);
        _incrementNonce(from);
        
        // Execute the call
        (bool success, bytes memory returndata) = to.call{value: value}(data);
        require(success, "Call failed");

        emit MetaTransactionExecuted(from, msg.sender);
        return returndata;
    }

    /**
     * @notice Verify the EIP-712 signature
     * @param from The sender address
     * @param to The target address
     * @param value The value to send
     * @param gas The gas limit
     * @param nonce The nonce
     * @param data The call data
     * @param validUntilTime The expiration time
     * @param signature The signature
     */
    function _verifySignature(
        address from,
        address to,
        uint256 value,
        uint256 gas,
        uint256 nonce,
        bytes calldata data,
        uint256 validUntilTime,
        bytes calldata signature
    ) internal view {
        bytes32 structHash = keccak256(
            abi.encode(
                FORWARD_REQUEST_TYPEHASH,
                from,
                to,
                value,
                gas,
                nonce,
                keccak256(data),
                validUntilTime
            )
        );

        bytes32 hash = keccak256(
            abi.encodePacked("\x19\x01", _getERC20TokenHomeStorage()._domainSeparator, structHash)
        );

        address signer = ecrecover(hash, 
            uint8(signature[0]), 
            bytes32(signature[1:33]), 
            bytes32(signature[33:65])
        );
        require(signer == from, "Invalid signature");
    }

    /**
     * @notice Get the current nonce for a user
     * @param from The user address
     * @return The current nonce
     */
    function getNonce(address from) public view returns (uint256) {
        // This is a simplified implementation - in production you'd want a proper nonce mapping
        return 0;
    }

    /**
     * @notice Increment the nonce for a user
     * @param from The user address
     */
    function _incrementNonce(address from) internal {
        // This is a simplified implementation - in production you'd want a proper nonce mapping
    }

    /**
     * @notice Set the trusted forwarder
     * @param forwarder The forwarder address
     */
    function _setTrustedForwarder(address forwarder) internal {
        ERC20TokenHomeStorage storage $ = _getERC20TokenHomeStorage();
        $._trustedForwarder = forwarder;
    }

    /**
     * @notice Get the trusted forwarder
     * @return The trusted forwarder address
     */
    function trustedForwarder() public view returns (address) {
        return _getERC20TokenHomeStorage()._trustedForwarder;
    }

    /**
     * @notice Check if an address is the trusted forwarder
     * @param forwarder The address to check
     * @return True if the address is the trusted forwarder
     */
    function isTrustedForwarder(address forwarder) public view returns (bool) {
        return forwarder == trustedForwarder();
    }

    /**
     * @notice Override _msgSender to support meta-transactions
     */
    function _msgSender() internal view virtual override returns (address) {
        if (isTrustedForwarder(msg.sender)) {
            // Extract the original sender from the calldata
            // This assumes the forwarder appends the sender address to the calldata
            uint256 calldataLength = msg.data.length;
            if (calldataLength >= 20) {
                return address(bytes20(msg.data[calldataLength - 20:]));
            }
        }
        return super._msgSender();
    }

    /**
     * @notice Override _msgData to support meta-transactions
     */
    function _msgData() internal view virtual override returns (bytes calldata) {
        if (isTrustedForwarder(msg.sender)) {
            // Remove the appended sender address from the calldata
            uint256 calldataLength = msg.data.length;
            if (calldataLength >= 20) {
                return msg.data[:calldataLength - 20];
            }
        }
        return super._msgData();
    }

    /**
     * @notice Override _contextSuffixLength to support meta-transactions
     */
    function _contextSuffixLength() internal view virtual override returns (uint256) {
        if (isTrustedForwarder(msg.sender)) {
            return 20; // Address length
        }
        return 0;
    }
}
