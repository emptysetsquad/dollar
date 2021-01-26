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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../token/IDollar.sol";
import "./IDAO.sol";
import "./IUSDC.sol";
import "../streaming/Stream.sol";

contract PoolAccount {
    struct State {
        uint256 staged;
        uint256 claimable;
        uint256 bonded;
        uint256 phantom;
        Stream.Stream lpStream;
        Stream.Stream rewardStream;
    }
}

contract PoolStorage {
    struct Provider {
        IDAO dao;
        IDollar dollar;
        IERC20 univ2;
    }
    
    struct Balance {
        uint256 staged;
        uint256 claimable;
        uint256 bonded;
        uint256 phantom;
    }

    struct State {
        Balance balance;
        Provider provider;

        bool paused;
        bool isInitialized;

        mapping(address => PoolAccount.State) accounts;
    }
}

contract PoolState {
    PoolStorage.State _state;

    uint256 _totalRewardStreamable;
    uint256 _upgradeTimestamp;
}
