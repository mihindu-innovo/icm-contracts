// (c) 2024, Ava Labs, Inc. All rights reserved.
// See the file LICENSE for licensing terms.

// SPDX-License-Identifier: LicenseRef-Ecosystem

pragma solidity 0.8.25;

import {ECDSA} from "@openzeppelin/contracts@5.0.2/utils/cryptography/ECDSA.sol";
import {EIP712} from "@openzeppelin/contracts@5.0.2/utils/cryptography/EIP712.sol";
import {Nonces} from "@openzeppelin/contracts@5.0.2/utils/Nonces.sol";

/**
 * @title MinimalForwarder
 * @notice Simple minimal forwarder to be used together with an ERC2771 compatible contract for gasless meta-transactions.
 * This contract follows the ERC-2771 standard for meta-transactions.
 * @custom:security-contact https://github.com/ava-labs/icm-contracts/blob/main/SECURITY.md
 */
contract MinimalForwarder is EIP712, Nonces {
    using ECDSA for bytes32;

    struct ForwardRequestData {
        address from;
        address to;
        uint256 value;
        uint256 gas;
        uint256 nonce;
        uint48 deadline;
        bytes data;
    }

    bytes32 private constant FORWARD_REQUEST_TYPEHASH = keccak256(
        "ForwardRequestData(address from,address to,uint256 value,uint256 gas,uint256 nonce,uint48 deadline,bytes data)"
    );

    /**
     * @notice Event emitted when a meta-transaction is executed successfully
     * @param signer The address of the transaction signer
     * @param nonce The nonce used for the transaction
     * @param success Whether the forwarded call was successful
     */
    event MetaTransactionExecuted(address indexed signer, uint256 nonce, bool success);

    constructor() EIP712("MinimalForwarder", "0.0.1") {}

    /**
     * @notice Gets the current nonce for an address
     * @param from The address to get the nonce for
     * @return The current nonce
     */
    function getNonce(address from) public view returns (uint256) {
        return nonces(from);
    }

    /**
     * @notice Verifies that a signature is valid for the given request
     * @param req The forward request data
     * @param signature The signature to verify
     * @return Whether the signature is valid
     */
    function verify(ForwardRequestData calldata req, bytes calldata signature) public view returns (bool) {
        return _verify(req, signature);
    }

    /**
     * @notice Executes a meta-transaction
     * @param req The forward request data
     * @param signature The signature authorizing the transaction
     * @return success Whether the forwarded call was successful
     * @return returndata The return data from the forwarded call
     */
    function execute(ForwardRequestData calldata req, bytes calldata signature)
        public
        payable
        returns (bool success, bytes memory returndata)
    {
        require(_verify(req, signature), "MinimalForwarder: signature does not match request");
        require(req.deadline == 0 || req.deadline >= block.timestamp, "MinimalForwarder: request expired");

        _useNonce(req.from);

        (success, returndata) = req.to.call{gas: req.gas, value: req.value}(
            abi.encodePacked(req.data, req.from)
        );

        // Validate that the forwarded call used at most the specified gas
        require(gasleft() > req.gas / 63, "MinimalForwarder: insufficient gas");

        emit MetaTransactionExecuted(req.from, req.nonce, success);
    }

    /**
     * @notice Internal function to verify a signature
     * @param req The forward request data
     * @param signature The signature to verify
     * @return Whether the signature is valid
     */
    function _verify(ForwardRequestData calldata req, bytes calldata signature) internal view returns (bool) {
        return _hashTypedDataV4(_hash(req)).recover(signature) == req.from;
    }

    /**
     * @notice Internal function to hash a forward request
     * @param req The forward request data
     * @return The hash of the request
     */
    function _hash(ForwardRequestData calldata req) internal pure returns (bytes32) {
        return keccak256(
            abi.encode(
                FORWARD_REQUEST_TYPEHASH,
                req.from,
                req.to,
                req.value,
                req.gas,
                req.nonce,
                req.deadline,
                keccak256(req.data)
            )
        );
    }
}