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

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./PoolState.sol";
import "../Constants.sol";
import "../streaming/StreamingGetters.sol";

contract PoolGetters is PoolState, StreamingGetters {
    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    /**
     * Global
     */

    function usdc() public view returns (address) {
        return Constants.getUsdcAddress();
    }

    function dao() public view returns (IDAO) {
        return _state.provider.dao;
    }

    function dollar() public view returns (IDollar) {
        return _state.provider.dollar;
    }

    function univ2() public view returns (IERC20) {
        return _state.provider.univ2;
    }

    function totalBonded() public view returns (uint256) {
        return _state.balance.bonded;
    }

    function totalStaged() public view returns (uint256) {
        return _state.balance.staged;
    }

    function totalClaimable() public view returns (uint256) {
        return _state.balance.claimable;
    }

    function totalPhantom() public view returns (uint256) {
        return _state.balance.phantom;
    }

    function totalRewardStreamable() public view returns (uint256) {
        return _totalRewardStreamable;
    }

    function totalRewarded() public view returns (uint256) {
        return dollar().balanceOf(address(this)).sub(totalClaimable()).sub(totalRewardStreamable());
    }

    function paused() public view returns (bool) {
        return _state.paused;
    }

    // internal getter
    function upgradeTimestamp() internal view returns (uint256) {
        return _upgradeTimestamp;
    }

    /**
     * Account
     */

    function balanceOfStaged(address account) public view returns (uint256) {
        return _state.accounts[account].staged;
    }

    function balanceOfClaimable(address account) public view returns (uint256) {
        return _state.accounts[account].claimable;
    }

    function balanceOfBonded(address account) public view returns (uint256) {
        return _state.accounts[account].bonded;
    }

    function balanceOfPhantom(address account) public view returns (uint256) {
        return _state.accounts[account].phantom;
    }

    function balanceOfRewarded(address account) public view returns (uint256) {
        uint256 totalBonded = totalBonded();
        if (totalBonded == 0) {
            return 0;
        }

        uint256 totalRewardedWithPhantom = totalRewarded().add(totalPhantom());
        uint256 balanceOfRewardedWithPhantom = totalRewardedWithPhantom
            .mul(balanceOfBonded(account))
            .div(totalBonded);

        uint256 balanceOfPhantom = balanceOfPhantom(account);
        if (balanceOfRewardedWithPhantom > balanceOfPhantom) {
            return balanceOfRewardedWithPhantom.sub(balanceOfPhantom);
        }
        return 0;
    }

    /**
     * Streaming LP
     */

    // internal getter
    function streamLp(address account) internal view returns (Stream storage) {
        return _state.accounts[account].lpStream;
    }

    function streamedLpFrom(address account) public view returns (uint256) {
        return streamedFrom(streamLp(account));
    }

    function streamedLpUntil(address account) public view returns (uint256) {
        return streamedUntil(streamLp(account));
    }

    function streamLpDuration(address account) public view returns (uint256) {
        return streamDuration(streamLp(account));
    }

    function streamLpTimeleft(address account) public view returns (uint256) {
        return streamTimeleft(streamLp(account));
    }

    function streamLpReserved(address account) public view returns (uint256) {
        return streamReserved(streamLp(account));
    }

    function streamLpReleased(address account) public view returns (uint256) {
        return streamReleased(streamLp(account));
    }

    function streamLpBoosted(address account) public view returns (uint256) {
        return streamBoosted(streamLp(account));
    }

    function releasableLpAmount(address account) public view returns (uint256) {
        return releasableAmount(streamLp(account));
    }

    function unreleasedLpAmount(address account) public view returns (uint256) {
        return unreleasedAmount(streamLp(account));
    }

    /**
     * Streaming Reward
     */

    // internal getter
    function streamReward(address account) internal view returns (Stream storage) {
        return _state.accounts[account].rewardStream;
    }

    function streamedRewardFrom(address account) public view returns (uint256) {
        return streamedFrom(streamReward(account));
    }

    function streamedRewardUntil(address account) public view returns (uint256) {
        return streamedUntil(streamReward(account));
    }

    function streamRewardDuration(address account) public view returns (uint256) {
        return streamDuration(streamReward(account));
    }

    function streamRewardTimeleft(address account) public view returns (uint256) {
        return streamTimeleft(streamReward(account));
    }

    function streamRewardReserved(address account) public view returns (uint256) {
        return streamReserved(streamReward(account));
    }

    function streamRewardReleased(address account) public view returns (uint256) {
        return streamReleased(streamReward(account));
    }

    function streamRewardBoosted(address account) public view returns (uint256) {
        return streamBoosted(streamReward(account));
    }

    function releasableRewardAmount(address account) public view returns (uint256) {
        return releasableAmount(streamReward(account));
    }

    function unreleasedRewardAmount(address account) public view returns (uint256) {
        return unreleasedAmount(streamReward(account));
    }

    /**
     * Epoch
     */

    function epoch() internal view returns (uint256) {
        return dao().epoch();
    }

    function blockTimestamp() internal view returns (uint256) {
        return block.timestamp;
    }
}
