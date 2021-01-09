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

import "../dao/Regulator.sol";
import "../dao/Market.sol";
import "../oracle/IOracle.sol";
import "./MockComptroller.sol";
import "./MockState.sol";

contract MockRegulator is MockComptroller, Regulator {
    bytes32 private constant FILE = "MockRegulator";

    constructor (address oracle, address pool) MockComptroller(pool) public {
        _state.provider.oracle = IOracle(oracle);
    }

    function stepE() external {
        super.step();
    }

    function bootstrappingAt(uint256 epoch) public view returns (bool) {
        return epoch <= 5;
    }

    function settleCouponAuctionE() external {
        super.settleCouponAuction();
    }

    function cancelCouponAuctionAtEpochE(uint256 epoch) external {
        super.cancelCouponAuctionAtEpoch(epoch);
    }

    function finishCouponAuctionAtEpochE(uint256 epoch) external {
         super.finishCouponAuctionAtEpoch(epoch);
    }

    function initCouponAuctionE() external {
        super.initCouponAuction();
    }

    function getCouponAuctionBidsE() external returns (uint256) {
        return super.getCouponAuctionBids();
    }

    function getCouponAuctionMinExpiryE() external returns (uint256) {
        return super.getCouponAuctionMinExpiry();
    }

    function getCouponAuctionMaxExpiryE() external returns (uint256) {
        return super.getCouponAuctionMaxExpiry();
    }

    function getCouponAuctionMinYieldE() external returns (uint256) {
        return super.getCouponAuctionMinYield();
    }

    function getCouponAuctionMaxYieldE() external returns (uint256) {
        return super.getCouponAuctionMaxYield();
    }

    function getCouponAuctionMinDollarAmountE() external returns (uint256) {
        return super.getCouponAuctionMinDollarAmount();
    }

    function getCouponAuctionMaxDollarAmountE() external returns (uint256) {
        return super.getCouponAuctionMaxDollarAmount();
    }

    /* for testing only */

    function placeCouponAuctionBid(uint256 couponEpochExpiry, uint256 dollarAmount, uint256 maxCouponAmount) external returns (bool) {
        Require.that(
            couponEpochExpiry > 0,
            FILE,
            "Must have non-zero expiry"
        );
        
        Require.that(
            dollarAmount > 0,
            FILE,
            "Must bid non-zero amount"
        );
        
        Require.that(
            maxCouponAmount > 0,
            FILE,
            "Must bid on non-zero amount"
        );
        
        Require.that(
            totalDebt() >= dollarAmount,
            FILE,
            "Not enough debt"
        );

        uint256 epoch = epoch().add(couponEpochExpiry);
        setCouponAuctionRelYield(maxCouponAmount.div(dollarAmount));
        setCouponAuctionRelDollarAmount(dollarAmount);
        setCouponAuctionRelExpiry(epoch);
        setCouponBidderState(msg.sender, epoch, dollarAmount, maxCouponAmount);
        setCouponBidderStateIndex(getCouponAuctionBids(), msg.sender);
        incrementCouponAuctionBids();
        return true;
    }
}
