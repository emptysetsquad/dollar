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

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Market.sol";
import "./Regulator.sol";
import "./Bonding.sol";
import "./Govern.sol";
import "../Constants.sol";

/// @author Empty Set Squad
/// @title Top-level contract for døllar's DAO
contract Implementation is State, Bonding, Market, Regulator, Govern {
    using SafeMath for uint256;

    event Advance(uint256 indexed epoch, uint256 block, uint256 timestamp);
    event Incentivization(address indexed account, uint256 amount);
    event Vest(address indexed account, uint256 value);

    /// @dev One-time initialization logic that runs on implementation commit.
    function initialize() initializer public {
        // Reward committer
        mintToAccount(msg.sender, Constants.getAdvanceIncentive());
    }

    /// @dev Advances the epoch and runs accompanying logic
    function advance() external incentivized {
        Bonding.step();
        Regulator.step();
        Market.step();

        emit Advance(epoch(), block.number, block.timestamp);
    }

    /// @dev Opt-in to vesting schedule for bonded ESD
    function vest() external {
        initializeVesting(msg.sender);

        emit Vest(msg.sender, balanceOf(msg.sender));
    }

    modifier incentivized {
        // Mint advance reward to sender
        uint256 incentive = Constants.getAdvanceIncentive();
        mintToAccount(msg.sender, incentive);
        emit Incentivization(msg.sender, incentive);

        // Mint legacy pool reward for migration
        mintToAccount(Constants.getLegacyPoolAddress(), Constants.getLegacyPoolReward());

        _;
    }
}
