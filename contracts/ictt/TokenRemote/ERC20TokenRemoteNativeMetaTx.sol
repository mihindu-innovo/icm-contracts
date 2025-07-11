// (c) 2024, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

// SPDX-License-Identifier: LicenseRef-Ecosystem

pragma solidity 0.8.25;

import {ERC20TokenRemoteUpgradeable} from "./ERC20TokenRemoteUpgradeable.sol";
import {TokenRemoteSettings} from "./interfaces/ITokenRemote.sol";
import {ICMInitializable} from "@utilities/ICMInitializable.sol";
import {ECDSA} from "@openzeppelin/contracts@5.0.2/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts@5.0.2/utils/cryptography/EIP712.sol";
import {Nonces} from "@openzeppelin/contracts@5.0.2/utils/Nonces.sol";
import {Context} from "@openzeppelin/contracts@5.0.2/utils/Context.sol";
import {
    SendTokensInput,
    SendAndCallInput
} from "../interfaces/ITokenTransferrer.sol";

/**
 * @title ERC20TokenRemoteNativeMetaTx
 * @notice ERC20TokenRemote with native meta-transaction support for Ava Cloud relayer.
 * This version implements direct meta-transaction handling without requiring a separate forwarder contract.
 * @custom:security-contact https://github.com/ava-labs/icm-contracts/blob/main/SECURITY.md
 */
contract ERC20TokenRemoteNativeMetaTx is ERC20TokenRemoteUpgradeable, EIP712, Nonces {
    using ECDSA for bytes32;

    // Meta-transaction typehashes
    bytes32 private constant SEND_TYPEHASH = keccak256(
        "Send(address from,SendTokensInput input,uint256 amount,uint256 nonce,uint256 deadline)SendTokensInput(bytes32 destinationBlockchainID,address destinationTokenTransferrerAddress,address recipient,address primaryFeeTokenAddress,uint256 primaryFee,uint256 secondaryFee,uint256 requiredGasLimit,address multiHopFallback)"
    );

    bytes32 private constant SEND_AND_CALL_TYPEHASH = keccak256(
        "SendAndCall(address from,SendAndCallInput input,uint256 amount,uint256 nonce,uint256 deadline)SendAndCallInput(bytes32 destinationBlockchainID,address destinationTokenTransferrerAddress,address recipientContract,uint256 requiredGasLimit,uint256 recipientGasLimit,address multiHopFallback,address fallbackRecipient,address primaryFeeTokenAddress,uint256 primaryFee,uint256 secondaryFee,bytes recipientPayload)"
    );

    bytes32 private constant SEND_TOKENS_INPUT_TYPEHASH = keccak256(
        "SendTokensInput(bytes32 destinationBlockchainID,address destinationTokenTransferrerAddress,address recipient,address primaryFeeTokenAddress,uint256 primaryFee,uint256 secondaryFee,uint256 requiredGasLimit,address multiHopFallback)"
    );

    bytes32 private constant SEND_AND_CALL_INPUT_TYPEHASH = keccak256(
        "SendAndCallInput(bytes32 destinationBlockchainID,address destinationTokenTransferrerAddress,address recipientContract,uint256 requiredGasLimit,uint256 recipientGasLimit,address multiHopFallback,address fallbackRecipient,address primaryFeeTokenAddress,uint256 primaryFee,uint256 secondaryFee,bytes recipientPayload)"
    );

    event MetaTransactionExecuted(address indexed user, uint256 nonce, bytes32 functionSelector);

    constructor(
        TokenRemoteSettings memory settings,
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals
    ) 
        ERC20TokenRemoteUpgradeable(ICMInitializable.Allowed)
        EIP712("ERC20TokenRemoteNativeMetaTx", "1.0.0")
    {
        initialize(settings, tokenName, tokenSymbol, tokenDecimals);
    }

    /**
     * @notice Execute a meta-transaction for sending tokens
     * @param from The address of the user who signed the meta-transaction
     * @param input The send tokens input parameters
     * @param amount The amount of tokens to send
     * @param deadline The deadline for the meta-transaction (0 for no deadline)
     * @param signature The user's signature authorizing the transaction
     */
    function metaSend(
        address from,
        SendTokensInput calldata input,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(deadline == 0 || deadline >= block.timestamp, "ERC20TokenRemoteNativeMetaTx: expired");
        
        uint256 nonce = _useNonce(from);
        
        bytes32 structHash = keccak256(abi.encode(
            SEND_TYPEHASH,
            from,
            _hashSendTokensInput(input),
            amount,
            nonce,
            deadline
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);
        require(signer == from, "ERC20TokenRemoteNativeMetaTx: invalid signature");

        // Override _msgSender for this call
        _executeAsSender(from, abi.encodeCall(this.send, (input, amount)));
        
        emit MetaTransactionExecuted(from, nonce, bytes32(bytes4(keccak256("send(SendTokensInput,uint256)"))));
    }

    /**
     * @notice Execute a meta-transaction for sending tokens with a call
     * @param from The address of the user who signed the meta-transaction
     * @param input The send and call input parameters
     * @param amount The amount of tokens to send
     * @param deadline The deadline for the meta-transaction (0 for no deadline)
     * @param signature The user's signature authorizing the transaction
     */
    function metaSendAndCall(
        address from,
        SendAndCallInput calldata input,
        uint256 amount,
        uint256 deadline,
        bytes calldata signature
    ) external {
        require(deadline == 0 || deadline >= block.timestamp, "ERC20TokenRemoteNativeMetaTx: expired");
        
        uint256 nonce = _useNonce(from);
        
        bytes32 structHash = keccak256(abi.encode(
            SEND_AND_CALL_TYPEHASH,
            from,
            _hashSendAndCallInput(input),
            amount,
            nonce,
            deadline
        ));
        
        bytes32 hash = _hashTypedDataV4(structHash);
        address signer = hash.recover(signature);
        require(signer == from, "ERC20TokenRemoteNativeMetaTx: invalid signature");

        // Override _msgSender for this call
        _executeAsSender(from, abi.encodeCall(this.sendAndCall, (input, amount)));
        
        emit MetaTransactionExecuted(from, nonce, bytes32(bytes4(keccak256("sendAndCall(SendAndCallInput,uint256)"))));
    }

    /**
     * @notice Get the current nonce for a user
     * @param user The user address
     * @return The current nonce
     */
    function getNonce(address user) external view returns (uint256) {
        return nonces(user);
    }

    /**
     * @dev Internal function to execute a call as a specific sender
     */
    function _executeAsSender(address sender, bytes memory data) internal {
        // Temporarily store the current sender
        address originalSender = _currentSender;
        _currentSender = sender;
        
        // Execute the call
        (bool success, bytes memory result) = address(this).call(data);
        
        // Restore the original sender
        _currentSender = originalSender;
        
        if (!success) {
            // Bubble up the revert reason
            if (result.length > 0) {
                assembly {
                    revert(add(result, 32), mload(result))
                }
            } else {
                revert("ERC20TokenRemoteNativeMetaTx: meta-transaction failed");
            }
        }
    }

    // Storage for current sender during meta-transaction execution
    address private _currentSender;

    /**
     * @dev Override _msgSender to return the meta-transaction signer when applicable
     */
    function _msgSender() internal view override(Context) returns (address) {
        if (_currentSender != address(0)) {
            return _currentSender;
        }
        return super._msgSender();
    }

    /**
     * @dev Hash a SendTokensInput struct
     */
    function _hashSendTokensInput(SendTokensInput calldata input) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            SEND_TOKENS_INPUT_TYPEHASH,
            input.destinationBlockchainID,
            input.destinationTokenTransferrerAddress,
            input.recipient,
            input.primaryFeeTokenAddress,
            input.primaryFee,
            input.secondaryFee,
            input.requiredGasLimit,
            input.multiHopFallback
        ));
    }

    /**
     * @dev Hash a SendAndCallInput struct
     */
    function _hashSendAndCallInput(SendAndCallInput calldata input) internal pure returns (bytes32) {
        return keccak256(abi.encode(
            SEND_AND_CALL_INPUT_TYPEHASH,
            input.destinationBlockchainID,
            input.destinationTokenTransferrerAddress,
            input.recipientContract,
            input.requiredGasLimit,
            input.recipientGasLimit,
            input.multiHopFallback,
            input.fallbackRecipient,
            input.primaryFeeTokenAddress,
            input.primaryFee,
            input.secondaryFee,
            keccak256(input.recipientPayload)
        ));
    }
}