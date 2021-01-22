/*
    Copyright 2021 Universal Dollar Devs, based on the works of the Empty Set Squad

    Licensed under the Apache License, Version 2.0 (the "License");
    you may not use this file except in compliance with the License.
    You may obtain a copy of the License at

    http://www.apache.org/licenses/LICENSE-2.0

    Unless required by applicable law or agreed to in writing, software
    distributed under the License is distributed on an "AS IS" BASIS,
    WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
    See the License for the specific language governing permissions and
    limitations under the License.
*/

pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "./Setters.sol";
import "../external/Require.sol";

contract Permission is Setters {

    bytes32 private constant FILE = "Permission";

    modifier onlyPool() {
        Require.that(
            msg.sender == address(pool()),
            FILE,
            "Not pool"
        );

        _;
    }

    // Can modify account state
    modifier onlyUnlocked(address account) {
        Require.that(
            statusOf(account) != Account.Status.Locked,
            FILE,
            "Not unlocked"
        );

        _;
    }

    modifier initializer() {
        Require.that(
            !isInitialized(implementation()),
            FILE,
            "Already initialized"
        );

        initialized(implementation());

        _;
    }
}
