// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {Initializable} from "@openzeppelin/contracts-upgradeable/proxy/utils/Initializable.sol";
import {ERC20Upgradeable} from "@openzeppelin/contracts-upgradeable/token/ERC20/ERC20Upgradeable.sol";
import {OwnableUpgradeable} from "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import {UUPSUpgradeable} from "@openzeppelin/contracts-upgradeable/proxy/utils/UUPSUpgradeable.sol";

/// @title MyToken V1 (implementation / logic contract)
/// @notice Upgradeable version of the earlier MyToken (MTK):
///         same name, symbol, owner-only mint, standard ERC20 transfers.
/// @dev UUPS pattern: the upgrade logic lives here, in the implementation,
///      and only the owner may upgrade. A proxy holds all state and
///      delegates every call to this contract.
contract MyTokenV1 is Initializable, ERC20Upgradeable, OwnableUpgradeable, UUPSUpgradeable {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() {
        // The implementation itself must never be initialized; only the proxy is.
        _disableInitializers();
    }

    /// @notice Replaces the constructor: runs once, through the proxy.
    function initialize(address initialOwner, uint256 initialSupply) public initializer {
        __ERC20_init("MyToken", "MTK");
        __Ownable_init(initialOwner);
        _mint(initialOwner, initialSupply);
    }

    /// @notice Creates `amount` new tokens for `to`. Only the owner can call it.
    function mint(address to, uint256 amount) external onlyOwner {
        _mint(to, amount);
    }

    /// @dev Required by UUPS: only the owner may point the proxy at a new implementation.
    function _authorizeUpgrade(address newImplementation) internal override onlyOwner {}
}
