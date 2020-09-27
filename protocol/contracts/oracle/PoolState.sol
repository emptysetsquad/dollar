/*
    Copyright 2020 Empty Set Squad <emptysetsquad@protonmail.com>

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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../token/IDollar.sol";
import "./IDAO.sol";
import "./IUSDC.sol";

contract PoolAccount {
    enum Status {
        Frozen,
        Fluid,
        Locked
    }

    struct State {
        uint256 staged;
        uint256 claimable;
        uint256 bonded;
        uint256 phantom;
        uint256 fluidUntil;
    }
}

contract PoolStorage {
    struct Balance {
        uint256 staged;
        uint256 claimable;
        uint256 bonded;
        uint256 phantom;
    }

    struct State {
        Balance balance;
        bool paused;

        mapping(address => PoolAccount.State) accounts;
    }
}

contract PoolState {
    PoolStorage.State _state;
}
