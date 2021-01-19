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

    function settleCouponAuctionE(uint256 epoch) external {
        super.settleCouponAuction(epoch);
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

    function getCouponAuctionBidsE(uint256 epoch) external returns (uint256) {
        return super.getCouponAuctionBids(epoch);
    }

    function getCouponAuctionMinExpiryE(uint256 epoch) external returns (uint256) {
        return super.getCouponAuctionMinExpiry(epoch);
    }

    function getCouponAuctionMaxExpiryE(uint256 epoch) external returns (uint256) {
        return super.getCouponAuctionMaxExpiry(epoch);
    }

    function getCouponAuctionMinYieldE(uint256 epoch) external returns (uint256) {
        return super.getCouponAuctionMinYield(epoch);
    }

    function getCouponAuctionMaxYieldE(uint256 epoch) external returns (uint256) {
        return super.getCouponAuctionMaxYield(epoch);
    }

    function getCouponAuctionMinDollarAmountE(uint256 epoch) external returns (uint256) {
        return super.getCouponAuctionMinDollarAmount(epoch);
    }

    function getCouponAuctionMaxDollarAmountE(uint256 epoch) external returns (uint256) {
        return super.getCouponAuctionMaxDollarAmount(epoch);
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
            acceptableBidCheck(msg.sender, dollarAmount),
            FILE,
            "Must have enough in account"
        );

        uint256 yield = maxCouponAmount.div(dollarAmount);
        uint256 maxYield = Constants.getCouponMaxYieldToBurn();

        Require.that(
            maxYield >= yield,
            FILE,
            "Must be under maxYield"
        );

        uint256 epochExpiry = epoch().add(couponEpochExpiry);
        setCouponAuctionRelYield(maxCouponAmount.div(dollarAmount));
        setCouponAuctionRelDollarAmount(dollarAmount);
        setCouponAuctionRelExpiry(epochExpiry);
        setCouponBidderState(uint256(epoch()), msg.sender, couponEpochExpiry, dollarAmount, maxCouponAmount);
        setCouponBidderStateIndex(uint256(epoch()), getCouponAuctionBids(uint256(epoch())), msg.sender);
        incrementCouponAuctionBids();
        return true;
    }
}
