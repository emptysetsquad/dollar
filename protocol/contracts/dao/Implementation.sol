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
import "./interfaces/IDAO.sol";
import "./Govern.sol";
import "./Permission.sol";
import "../Constants.sol";

contract Implementation is IDAO, State, Permission, Govern {
    using SafeMath for uint256;

    event Advance(uint256 indexed epoch, uint256 block, uint256 timestamp);
    event Incentivization(address indexed account, uint256 amount);
    event IncentivizationWithStake(address indexed account, uint256 amount);

    function initialize() initializer public {
        // Reward committer
        incentivize(msg.sender, Constants.getAdvanceIncentive());

        // emit final ratio
        emit TokenSplitSnapshot(totalBonded(), totalSupply());

        // Burn bonded
        dollar().burn(totalBonded());

        // Dev rewards
        incentivizeWithStake(address(0xdaeD3f8E267CF2e5480A379d75BfABad58ab2144), 2000000e18);
    }

    function advance() external {
        incentivize(msg.sender, Constants.getAdvanceIncentive());

        Govern.step();

        emit Advance(epoch(), block.number, block.timestamp);
    }

    function incentivize(address account, uint256 amount) private {
        dollar().mint(account, amount);
        emit Incentivization(account, amount);
    }

    function incentivizeWithStake(address account, uint256 amount) private {
        incrementBalanceOf(account, amount);
        emit IncentivizationWithStake(account, amount);
    }

    /*
     * Bonding Functions
     */
    function withdraw(uint256 value) external onlyFrozenOrLocked(msg.sender) {
        dollar().transfer(msg.sender, value);
        decrementBalanceOfStaged(msg.sender, value, "Bonding: insufficient staged balance");

        emit Withdraw(msg.sender, value);
    }

    /*
     * Market Functions
    */

    // @notice: logic overview
    // Redeem `amount` of underlying at the given `couponEpoch`
    // Reverts if balance of underlying at `couponEpoch` is less than `amount`
    function redeemCoupons(uint256 couponEpoch, uint256 amount) external {
        require(epoch().sub(couponEpoch) >= 2, "Market: Too early to redeem");
        require(amount != 0, "Market: Amount too low");

        decrementBalanceOfCouponUnderlying(msg.sender, couponEpoch, amount, "Market: Insufficient coupon underlying balance");
        dollar().mint(msg.sender, amount);

        emit CouponRedemption(msg.sender, couponEpoch, amount, 0);
    }

    function approveCoupons(address spender, uint256 amount) external {
        require(spender != address(0), "Market: Coupon approve to the zero address");

        updateAllowanceCoupons(msg.sender, spender, amount);

        emit CouponApproval(msg.sender, spender, amount);
    }

    function transferCoupons(address sender, address recipient, uint256 epoch, uint256 amount) external {
        require(sender != address(0), "Market: Coupon transfer from the zero address");
        require(recipient != address(0), "Market: Coupon transfer to the zero address");

        decrementBalanceOfCouponUnderlying(sender, epoch, amount, "Market: Insufficient coupon underlying balance");
        incrementBalanceOfCouponUnderlying(recipient, epoch, amount);

        if (msg.sender != sender && allowanceCoupons(sender, msg.sender) != uint256(-1)) {
            decrementAllowanceCoupons(sender, msg.sender, amount, "Market: Insufficient coupon approval");
        }

        emit CouponTransfer(sender, recipient, epoch, amount);
    }
}
