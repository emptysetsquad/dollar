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
import "./Setters.sol";
import "./Getters.sol";
import "./Permission.sol";
import "./Upgradeable.sol";

import "../Constants.sol";

contract Implementation is IDAO, Setters, Permission, Upgradeable  {
    using SafeMath for uint256;

    function initialize() initializer public {
        // Mint all remaining redeemable ESD for coupons to sunset programmatic ESD minting
        dollar().mint(address(this), totalCouponUnderlying());

        // Get current ESS balance of the v2 migrator
        uint256 migratorEssBalance = ess().balanceOf(v2Migrator());

        // Increment this DAO's balance of v1 ESDS to match migrators remaining ESS balance
        incrementBalanceOf(address(this), migratorEssBalance);

        // Exfiltrate remaining ESS from the v2 migrator
        IV2Migrator(v2Migrator()).migrate(0, migratorEssBalance);

        // Return ESS tokens to the Empty Set DAO
        ess().transfer(owner(), migratorEssBalance);

        // Verify ESS balances across affected contracts
        require(ess().balanceOf(v2Migrator()) == 0, "Implementation: migrator not empty");
        require(ess().balanceOf(address(this)) == 0, "Implementation: V1 DAO not empty");
        require(ess().balanceOf(owner()) == migratorEssBalance, "Implementation: tokens not returned");
    }

    /*
     * Continuous Dollar Migration
    */
    function burn(address account, uint256 amount) external onlyV2Migrator {
        decrementBalanceOf(account, amount, "V1_DAO: insufficient staked balance");
    }

    /**
     * Pool Withdraw
     */
    function poolWithdraw() external {
        require(!poolHasWithdrawn(msg.sender), "Pool Withdraw: already withdrawn");

        (uint256 univ2Amount, uint256 dollarAmount) = poolWithdrawable(msg.sender);

        if (univ2Amount > 0) {
            // Transfer univ2
            pool().univ2().transfer(msg.sender, univ2Amount);
        }

        if (dollarAmount > 0) {
            // Transfer dollar
            dollar().transfer(msg.sender, dollarAmount);
            decrementPoolDollarWithdrawable(dollarAmount, "Pool Withdraw: insufficient Dollar");
        }

        poolMarkWithdrawn(msg.sender);
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
     * Admin
     */
    function commit(address candidate) external onlyOwner {
        upgradeTo(candidate);
        emit Commit(msg.sender, candidate);
    }

    function changeOwner(address newOwner) external onlyOwner {
        address prevOwner = owner();
        setOwner(newOwner);
        emit OwnerChanged(prevOwner, newOwner);
    }

    /*
     * Bonding Functions
     */
    function withdraw(uint256 value) external {
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
        dollar().transfer(msg.sender, amount);

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
