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
import "./Curve.sol";
import "./Comptroller.sol";
import "../Constants.sol";

contract Market is Comptroller, Curve {
    using SafeMath for uint256;

    bytes32 private constant FILE = "Market";

    event CouponExpiration(uint256 indexed epoch, uint256 couponsExpired, uint256 lessRedeemable, uint256 lessDebt, uint256 newBonded);
    event CouponPurchase(address indexed account, uint256 indexed epoch, uint256 dollarAmount, uint256 couponAmount);
    event CouponRedemption(address indexed account, uint256 indexed epoch, uint256 amount, uint256 couponAmount);
    event CouponTransfer(address indexed from, address indexed to, uint256 indexed epoch, uint256 value);
    event CouponApproval(address indexed owner, address indexed spender, uint256 value);

    function step() internal {
        // Expire prior coupons
        for (uint256 i = 0; i < expiringCoupons(epoch()); i++) {
            expireCouponsForEpoch(expiringCouponsAtIndex(epoch(), i));
        }

        // Record expiry for current epoch's coupons
        uint256 expirationEpoch = epoch().add(Constants.getCouponExpiration());
        initializeCouponsExpiration(epoch(), expirationEpoch);
    }

    function expireCouponsForEpoch(uint256 epoch) private {
        uint256 couponsForEpoch = outstandingCoupons(epoch);
        (uint256 lessRedeemable, uint256 newBonded) = (0, 0);

        eliminateOutstandingCoupons(epoch);

        uint256 totalRedeemable = totalRedeemable();
        uint256 totalCoupons = totalCoupons();

        if (totalRedeemable > totalCoupons) {
            lessRedeemable = totalRedeemable.sub(totalCoupons);
            burnRedeemable(lessRedeemable);
            (, newBonded) = increaseSupply(lessRedeemable);
        }

        emit CouponExpiration(epoch, couponsForEpoch, lessRedeemable, 0, newBonded);
    }

    function couponPremium(uint256 amount) public view returns (uint256) {
        return calculateCouponPremium(dollar().totalSupply(), totalDebt(), amount);
    }

    function migrateCoupons(uint256 couponEpoch) external {
        uint256 balanceOfCoupons = balanceOfCoupons(msg.sender, couponEpoch);
        require(balanceOfCoupons > 0, "Market: No coupons");
        require(balanceOfCouponUnderlying(msg.sender, couponEpoch) == 0, "Market: Already migrated");

        uint256 couponUnderlying = balanceOfCoupons.div(2);

        incrementBalanceOfCouponUnderlying(msg.sender, couponEpoch, couponUnderlying);
        decrementBalanceOfCoupons(msg.sender, couponEpoch, couponUnderlying, "Market: Insufficient coupon balance");

        emit CouponRedemption(msg.sender, couponEpoch, 0, couponUnderlying);
        emit CouponPurchase(msg.sender, couponEpoch, couponUnderlying, 0);
    }

    function purchaseCoupons(uint256 amount) external returns (uint256) {
        Require.that(
            amount > 0,
            FILE,
            "Must purchase non-zero amount"
        );

        Require.that(
            totalDebt() >= amount,
            FILE,
            "Not enough debt"
        );

        uint256 epoch = epoch();
        uint256 couponAmount = couponPremium(amount);
        incrementBalanceOfCoupons(msg.sender, epoch, couponAmount);
        incrementBalanceOfCouponUnderlying(msg.sender, epoch, amount);

        burnFromAccount(msg.sender, amount);

        emit CouponPurchase(msg.sender, epoch, amount, couponAmount);

        return couponAmount;
    }

    // @notice: logic overview
    // 1) Coupons just purchased will fail at 2 epoch check.
    // 2) Valid coupons without sufficient redeemable will fail at redeemToAccount.
    // 3) Expired coupons will result in zero couponAmount, passing decrementBalanceOfCoupons
    //    and redeemToAccount to return underlying only.
    // 4) Expired coupons with future redeemable will still result in zero couponAmount,
    //    allowing only underlying to be redeemed.
    function redeemCoupons(uint256 couponEpoch, uint256 amount) external {
        require(epoch().sub(couponEpoch) >= 2, "Market: Too early to redeem");
        require(amount != 0, "Market: Amount too low");

        uint256 couponAmount = balanceOfCoupons(msg.sender, couponEpoch)
            .mul(amount).div(balanceOfCouponUnderlying(msg.sender, couponEpoch), "Market: No underlying");
        uint256 redeemableAmount = computeRedeemable(couponEpoch, couponAmount);

        decrementBalanceOfCouponUnderlying(msg.sender, couponEpoch, amount, "Market: Insufficient coupon underlying balance");
        if (couponAmount != 0) decrementBalanceOfCoupons(msg.sender, couponEpoch, couponAmount, "Market: Insufficient coupon balance");
        redeemToAccount(msg.sender, amount, redeemableAmount);

        emit CouponRedemption(msg.sender, couponEpoch, amount, couponAmount);
    }

    function computeRedeemable(uint256 couponEpoch, uint256 couponAmount) private view returns (uint256) {
        if (couponEpoch < couponProratedStart()) {
            return couponAmount;
        }

        uint256 lastContractionEpoch = computeLastContractionEpoch();
        uint256 lockedTime = lastContractionEpoch > couponEpoch ? lastContractionEpoch.sub(couponEpoch) : 0;
        lockedTime = lockedTime > Constants.getCouponExpiration() ? Constants.getCouponExpiration() : lockedTime;
        return couponAmount.mul(lockedTime).div(Constants.getCouponExpiration());
    }

    function computeLastContractionEpoch() private view returns (uint256) {
        if (eraStatus() == Era.Status.EXPANSION) {
            uint256 eraStart = eraStart();
            return eraStart == 0 ? 0 : eraStart.sub(1);
        }
        return epoch().sub(1);
    }

    function approveCoupons(address spender, uint256 amount) external {
        require(spender != address(0), "Market: Coupon approve to the zero address");

        updateAllowanceCoupons(msg.sender, spender, amount);

        emit CouponApproval(msg.sender, spender, amount);
    }

    function transferCoupons(address sender, address recipient, uint256 epoch, uint256 amount) external {
        require(sender != address(0), "Market: Coupon transfer from the zero address");
        require(recipient != address(0), "Market: Coupon transfer to the zero address");

        uint256 couponAmount = balanceOfCoupons(sender, epoch)
            .mul(amount).div(balanceOfCouponUnderlying(sender, epoch), "Market: No underlying");

        decrementBalanceOfCouponUnderlying(sender, epoch, amount, "Market: Insufficient coupon underlying balance");
        incrementBalanceOfCouponUnderlying(recipient, epoch, amount);

        decrementBalanceOfCoupons(sender, epoch, couponAmount, "Market: Insufficient coupon balance");
        incrementBalanceOfCoupons(recipient, epoch, couponAmount);

        if (msg.sender != sender && allowanceCoupons(sender, msg.sender) != uint256(-1)) {
            decrementAllowanceCoupons(sender, msg.sender, amount, "Market: Insufficient coupon approval");
        }

        emit CouponTransfer(sender, recipient, epoch, amount);
    }

    // overridable for testing
    function couponProratedStart() internal view returns (uint256) {
        return Constants.getCouponProratedStart();
    }
}
