// (c) 2024, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

// SPDX-License-Identifier: LicenseRef-Ecosystem

pragma solidity 0.8.25;

import {TokenRemoteERC2771} from "./TokenRemoteERC2771.sol";
import {TokenRemoteSettings} from "./interfaces/ITokenRemote.sol";
import {IERC20TokenTransferrer} from "../interfaces/IERC20TokenTransferrer.sol";
import {IERC20SendAndCallReceiver} from "../interfaces/IERC20SendAndCallReceiver.sol";
import {
    SendTokensInput,
    SendAndCallInput,
    SingleHopCallMessage
} from "../interfaces/ITokenTransferrer.sol";
import {IERC20} from "@openzeppelin/contracts@5.0.2/token/ERC20/ERC20.sol";
import {ERC20Upgradeable} from
    "@openzeppelin/contracts-upgradeable@5.0.2/token/ERC20/ERC20Upgradeable.sol";
import {SafeERC20TransferFrom} from "@utilities/SafeERC20TransferFrom.sol";
import {CallUtils} from "@utilities/CallUtils.sol";
import {ICMInitializable} from "@utilities/ICMInitializable.sol";
import {ERC2771Context} from "@openzeppelin/contracts@5.0.2/metatx/ERC2771Context.sol";
import {Context} from "@openzeppelin/contracts@5.0.2/utils/Context.sol";

/**
 * @title ERC20TokenRemoteUpgradeableERC2771
 * @notice This contract is an {IERC20TokenTransferrer} that receives tokens from its specifed {TokenHome} instance,
 * and represents the received tokens with an ERC20 token on this chain. This version supports ERC-2771 meta-transactions 
 * through trusted forwarders for gasless transactions.
 * @custom:security-contact https://github.com/ava-labs/icm-contracts/blob/main/SECURITY.md
 */
contract ERC20TokenRemoteUpgradeableERC2771 is IERC20TokenTransferrer, ERC20Upgradeable, TokenRemoteERC2771, ERC2771Context {
    // solhint-disable private-vars-leading-underscore
    /**
     * @dev Namespace storage slots following the ERC-7201 standard to prevent
     * storage collisions between upgradeable contracts.
     *
     * @custom:storage-location erc7201:avalanche-ictt.storage.ERC20TokenRemoteERC2771
     */
    struct ERC20TokenRemoteERC2771Storage {
        uint8 _decimals;
        /// @notice The trusted forwarder address for meta-transactions.
        address _trustedForwarder;
    }
    // solhint-enable private-vars-leading-underscore

    /**
     * @dev Storage slot computed based off ERC-7201 formula
     * keccak256(abi.encode(uint256(keccak256("avalanche-ictt.storage.ERC20TokenRemoteERC2771")) - 1)) & ~bytes32(uint256(0xff));
     */
    bytes32 public constant ERC20_TOKEN_REMOTE_ERC2771_STORAGE_LOCATION =
        0x9b9029a3537fcf0e984763da4ac33bbf592a3462819171bf424e91cf62622310;

    // solhint-disable ordering
    function _getERC20TokenRemoteERC2771Storage()
        private
        pure
        returns (ERC20TokenRemoteERC2771Storage storage $)
    {
        // solhint-disable-next-line no-inline-assembly
        assembly {
            $.slot := ERC20_TOKEN_REMOTE_ERC2771_STORAGE_LOCATION
        }
    }

    constructor(
        ICMInitializable init
    ) ERC2771Context(address(0)) {
        if (init == ICMInitializable.Disallowed) {
            _disableInitializers();
        }
    }

    /**
     * @notice Initializes this token TokenRemote instance to receive tokens from the specified TokenHome instance,
     * and represents the received tokens with an ERC20 token on this chain.
     * @param settings Constructor settings for this token TokenRemote instance.
     * @param tokenName The name of the ERC20 token.
     * @param tokenSymbol The symbol of the ERC20 token.
     * @param tokenDecimals The number of decimals for the ERC20 token.
     * @param trustedForwarder The address of the trusted forwarder for meta-transactions.
     */
    function initialize(
        TokenRemoteSettings memory settings,
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        address trustedForwarder
    ) public initializer {
        __ERC20TokenRemoteERC2771_init(settings, tokenName, tokenSymbol, tokenDecimals, trustedForwarder);
    }

    // solhint-disable-next-line func-name-mixedcase
    function __ERC20TokenRemoteERC2771_init(
        TokenRemoteSettings memory settings,
        string memory tokenName,
        string memory tokenSymbol,
        uint8 tokenDecimals,
        address trustedForwarder
    ) internal onlyInitializing {
        __ERC20_init(tokenName, tokenSymbol);
        __TokenRemoteERC2771_init(settings, 0, tokenDecimals);
        __ERC20TokenRemoteERC2771_init_unchained(tokenDecimals, trustedForwarder);
    }

    // solhint-disable-next-line func-name-mixedcase
    function __ERC20TokenRemoteERC2771_init_unchained(
        uint8 tokenDecimals,
        address trustedForwarder
    ) internal {
        ERC20TokenRemoteERC2771Storage storage $ = _getERC20TokenRemoteERC2771Storage();
        $._decimals = tokenDecimals;
        $._trustedForwarder = trustedForwarder;
    }
    // solhint-enable ordering

    /**
     * @dev Override _msgSender to support ERC-2771 meta-transactions
     */
    function _msgSender() internal view override(Context, ERC2771Context) returns (address) {
        return ERC2771Context._msgSender();
    }

    /**
     * @dev Override _msgData to support ERC-2771 meta-transactions
     */
    function _msgData() internal view override(Context, ERC2771Context) returns (bytes calldata) {
        return ERC2771Context._msgData();
    }

    /**
     * @dev Override _contextSuffixLength to support ERC-2771 meta-transactions
     */
    function _contextSuffixLength() internal view override(Context, ERC2771Context) returns (uint256) {
        return ERC2771Context._contextSuffixLength();
    }

    /**
     * @dev Override isTrustedForwarder to check against our stored trusted forwarder
     */
    function isTrustedForwarder(address forwarder) public view override returns (bool) {
        ERC20TokenRemoteERC2771Storage storage $ = _getERC20TokenRemoteERC2771Storage();
        return forwarder == $._trustedForwarder;
    }

    /**
     * @dev See {IERC20TokenTransferrer-send}
     *
     * Note: For transfers to an {input.destinationBlockchainID} that is not the {tokenHomeBlockchainID},
     * a multi-hop transfer is performed, where the tokens are sent back to the token TokenHome instance
     * first to check for token transfer balance, and then routed to the final destination TokenRemote instance.
     */
    function send(SendTokensInput calldata input, uint256 amount) external {
        _send(input, amount);
    }

    /**
     * @dev See {IERC20TokenTransferrer-sendAndCall}
     */
    function sendAndCall(SendAndCallInput calldata input, uint256 amount) external {
        _sendAndCall(input, amount);
    }

    /**
     * @dev See {ERC20-decimals}
     */
    function decimals() public view override returns (uint8) {
        ERC20TokenRemoteERC2771Storage storage $ = _getERC20TokenRemoteERC2771Storage();
        return $._decimals;
    }

    /**
     * @dev See {TokenRemote-_withdraw}
     */
    function _withdraw(address recipient, uint256 amount) internal virtual override {
        emit TokensWithdrawn(recipient, amount);
        _mint(recipient, amount);
    }

    /**
     * @dev See {TokenRemote-_burn}
     *
     * Spends the allowance the caller has given to this contract, and
     * calls {ERC20-_burn} to burn tokens from the sender.
     *
     * Note: The amount returned must match the amount credited as a result of the burn.
     * For a standard ERC20 implementation such as this contract, that is equal to the full amount given.
     * Child contracts with different {_burn} implementations may need to override this
     * implemenation to ensure the amount returned is correct.
     */
    function _burn(
        uint256 amount
    ) internal virtual override returns (uint256) {
        _spendAllowance(_msgSender(), address(this), amount);
        _burn(_msgSender(), amount);
        return amount;
    }

    /**
     * @dev See {TokenRemote-_handleSendAndCall}
     *
     * Mints the tokens to this contract, approves the recipient contract to spend them,
     * and calls {IERC20SendAndCallReceiver-receiveTokens} on the recipient contract.
     * If the call fails or doesn't spend all of the tokens, the remaining amount is
     * sent to the fallback recipient.
     */
    function _handleSendAndCall(
        SingleHopCallMessage memory message,
        uint256 amount
    ) internal virtual override {
        // Mint the tokens to this contract address.
        _mint(address(this), amount);

        // Approve the recipient contract to spend the amount.
        _approve(address(this), message.recipientContract, amount);

        // Encode the call to {IERC20SendAndCallReceiver-receiveTokens}
        bytes memory payload = abi.encodeCall(
            IERC20SendAndCallReceiver.receiveTokens,
            (
                message.sourceBlockchainID,
                message.originTokenTransferrerAddress,
                message.originSenderAddress,
                address(this),
                amount,
                message.recipientPayload
            )
        );

        // Call the recipient contract with the given payload and gas amount.
        bool success = CallUtils._callWithExactGas(
            message.recipientGasLimit, message.recipientContract, payload
        );

        // Check what the remaining allowance is to transfer to the fallback recipient.
        uint256 remainingAllowance = allowance(address(this), message.recipientContract);

        // Reset the recipient contract allowance to 0.
        _approve(address(this), message.recipientContract, 0);

        if (success) {
            emit CallSucceeded(message.recipientContract, amount);
        } else {
            emit CallFailed(message.recipientContract, amount);
        }

        // Transfer any remaining allowance to the fallback recipient. This will be the
        // full amount if the call failed.
        if (remainingAllowance > 0) {
            _transfer(address(this), message.fallbackRecipient, remainingAllowance);
        }
    }

    /**
     * @notice See {TokenRemote-_handleFees}
     *
     * If the {feeTokenAddress} is this contract, use the internal ERC20 calls
     * to transfer the tokens directly. Otherwise, use the {SafeERC20TransferFrom} library
     * to transfer the tokens.
     */
    function _handleFees(
        address feeTokenAddress,
        uint256 feeAmount
    ) internal virtual override returns (uint256) {
        if (feeAmount == 0) {
            return 0;
        }
        // If the {feeTokenAddress} is this contract, then just deposit the tokens directly.
        if (feeTokenAddress == address(this)) {
            _spendAllowance(_msgSender(), address(this), feeAmount);
            _transfer(_msgSender(), address(this), feeAmount);
            return feeAmount;
        }
        return
            SafeERC20TransferFrom.safeTransferFrom(IERC20(feeTokenAddress), _msgSender(), feeAmount);
    }
}