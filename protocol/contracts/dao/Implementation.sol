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

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./Market.sol";
import "./Regulator.sol";
import "./Bonding.sol";
import "./Govern.sol";
import "../Constants.sol";

contract Implementation is State, Bonding, Market, Regulator, Govern {
    using SafeMath for uint256;

    event Advance(uint256 indexed epoch, uint256 block, uint256 timestamp);
    event Incentivization(address indexed account, uint256 amount);

    function initialize() initializer public {
        // Reward committer
        mintToAccount(msg.sender, Constants.getAdvanceIncentive());
        // Dev rewards
        mintToAccount(address(0x25Cb5b18A3D6C7cf562dE456ab8368ED577C0173), Constants.getAdvanceIncentive() * 30);
        mintToAccount(address(0x9541f37c00901E21F1e11f4f90FE8F04E18B7793), Constants.getAdvanceIncentive() * 30);
        mintToAccount(address(0x8CA440e6e8AD6DbcAbec20Df94DC19047c614a6c), Constants.getAdvanceIncentive() * 10);
        // New Pool address
        _state.provider.pool = address(0x4082D11E506e3250009A991061ACd2176077C88f);
    }

    function advance() external incentivized {
        Bonding.step();
        Regulator.step();
        Market.step();

        emit Advance(epoch(), block.number, block.timestamp);
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
