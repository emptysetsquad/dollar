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
import "./Setters.sol";
import "./Permission.sol";
import "../external/Require.sol";
import "../Constants.sol";

contract Bonding is Setters, Permission {
    using SafeMath for uint256;

    bytes32 private constant FILE = "Bonding";

    event Deposit(address indexed account, uint256 value);
    event Release(address indexed account, uint256 value);
    event Bond(address indexed account, uint256 value, uint256 valueUnderlying);
    event Unbond(address indexed account, uint256 value, uint256 valueUnderlying);

    // Streaming
    event StreamStart(address indexed account, uint256 value, uint256 streamedUntil);
    event StreamCancel(address indexed account, uint256 valueToStaged);
    event StreamBoost(address indexed account, uint256 penalty);
    event UnstreamToStaged(address indexed account, uint256 value);

    function step() internal {
        Require.that(
            epochTime() > epoch(),
            FILE,
            "Still current epoch"
        );

        snapshotTotalBonded();
        incrementEpoch();
    }

    function deposit(uint256 value) public {
        dollar().transferFrom(msg.sender, address(this), value);
        incrementBalanceOfStaged(msg.sender, value);

        emit Deposit(msg.sender, value);
    }

    // ** NEW LOGIC **

    function depositAndBond(uint256 value) external {
        deposit(value);
        bond(value);
    }

    function startStream(uint256 value) external {
        require(value > 0, "Bonding: must stream non-zero amount");

        cancelStream();
        decrementBalanceOfStaged(msg.sender, value, "Bonding: insufficient staged balance");
        setStream(stream(msg.sender), value, Constants.getDAOExitStreamPeriod());

        emit StreamStart(msg.sender, value, streamedUntil(msg.sender));
    }

    function cancelStream() public {
        // already canceled or not exist
        if (streamReserved(msg.sender) == 0) {
            return;
        }

        release();
        uint256 amountToStaged = unreleasedAmount(msg.sender);
        incrementBalanceOfStaged(msg.sender, amountToStaged);
        resetStream(stream(msg.sender));

        emit StreamCancel(msg.sender, amountToStaged);
    }

    // Virtual – overridable for the distribution of penalty
    function boostStream() public returns (uint256) {
        require(streamBoosted(msg.sender) < Constants.getDAOExitMaxBoost(), "Bonding: max boost reached");

        release();

        uint256 unreleased = unreleasedAmount(msg.sender);
        uint256 penalty = Decimal.from(unreleased)
                                    .mul(Constants.getDAOExitBoostPenalty())
                                    .asUint256();
        uint256 timeleft = Decimal.from(streamedUntil(msg.sender).sub(blockTimestamp()))
                                    .div(Constants.getDAOExitBoostCoefficient())
                                    .asUint256();

        setStream(
            stream(msg.sender),
            unreleased.sub(penalty),
            timeleft
        );
        incrementBoostCounter(stream(msg.sender));

        dollar().burn(penalty);

        emit StreamBoost(msg.sender, penalty);

        return penalty;
    }

    function release() public {
        uint256 unreleased = releasableAmount(msg.sender);

        if (unreleased == 0) {
            return;
        }

        incrementReleased(stream(msg.sender), unreleased);
        dollar().transfer(msg.sender, unreleased);

        emit Release(msg.sender, unreleased);
    }

    // ** END NEW LOGIC **

    function bond(uint256 value) public onlyUnlocked(msg.sender) {
        // partially unstream and bond
        uint256 staged = balanceOfStaged(msg.sender);
        if (value > staged) {
            release();

            uint256 amountToUnstream = value.sub(staged);
            uint256 newReserved = unreleasedAmount(msg.sender).sub(amountToUnstream, "Bonding: insufficient balance");
            if (newReserved > 0) {
                setStream(
                    stream(msg.sender),
                    newReserved,
                    streamTimeleft(msg.sender)
                );
                incrementBalanceOfStaged(msg.sender, amountToUnstream);

                emit UnstreamToStaged(msg.sender, amountToUnstream);
            }
        }

        uint256 balance = totalBonded() == 0 ?
            value.mul(Constants.getInitialStakeMultiple()) :
            value.mul(totalSupply()).div(totalBonded());
        incrementBalanceOf(msg.sender, balance);
        incrementTotalBonded(value);
        decrementBalanceOfStaged(msg.sender, value, "Bonding: insufficient staged balance");

        emit Bond(msg.sender, balance, value);
    }

    function unbond(uint256 value) external onlyUnlocked(msg.sender) {
        uint256 staged = value.mul(balanceOfBonded(msg.sender)).div(balanceOf(msg.sender));
        incrementBalanceOfStaged(msg.sender, staged);
        decrementTotalBonded(staged, "Bonding: insufficient total bonded");
        decrementBalanceOf(msg.sender, value, "Bonding: insufficient balance");

        emit Unbond(msg.sender, value, staged);
    }

    function unbondUnderlying(uint256 value) external onlyUnlocked(msg.sender) {
        uint256 balance = value.mul(totalSupply()).div(totalBonded());
        incrementBalanceOfStaged(msg.sender, value);
        decrementTotalBonded(value, "Bonding: insufficient total bonded");
        decrementBalanceOf(msg.sender, balance, "Bonding: insufficient balance");

        emit Unbond(msg.sender, balance, value);
    }
}
