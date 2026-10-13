// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import {MyTokenV1} from "./MyTokenV1.sol";

/// @title MyToken V2 (new implementation)
/// @notice Everything from V1 plus a version() function.
/// @dev Storage layout stays compatible with V1:
///      - V2 inherits V1 unchanged, so all inherited state keeps its position;
///      - OpenZeppelin v5 upgradeable contracts keep their state in
///        ERC-7201 namespaced storage slots, not in sequential slots;
///      - V2 declares no new state variables.
///      The layout check is also enforced by test/MyTokenUpgrade.js
///      (upgrades.validateUpgrade).
/// @custom:oz-upgrades-from MyTokenV1
contract MyTokenV2 is MyTokenV1 {
    /// @custom:oz-upgrades-unsafe-allow constructor
    constructor() MyTokenV1() {}

    function version() public pure returns (string memory) {
        return "V2";
    }
}
