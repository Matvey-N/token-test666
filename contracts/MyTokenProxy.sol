// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {ERC1967Proxy} from "@openzeppelin/contracts/proxy/ERC1967/ERC1967Proxy.sol";

/// @title MyToken proxy (UUPS / ERC-1967)
/// @notice The address users and wallets talk to. It stores all token state
///         (balances, supply, owner) and forwards every call with delegatecall
///         to the current implementation (MyTokenV1, later MyTokenV2).
/// @dev The implementation address lives in the ERC-1967 slot
///      keccak256("eip1967.proxy.implementation") - 1, so it can never clash
///      with the token's own storage. The proxy has no upgrade function of its
///      own: in the UUPS pattern upgradeToAndCall() is implemented by the
///      implementation contract and reached through this proxy.
contract MyTokenProxy is ERC1967Proxy {
    /// @param implementation address of MyTokenV1
    /// @param data encoded call to initialize(owner, supply), executed once
    constructor(address implementation, bytes memory data)
        ERC1967Proxy(implementation, data)
    {}
}
