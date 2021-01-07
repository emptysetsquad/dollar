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

import "../dao/Auction.sol";
import "../dao/Market.sol";
import "./MockState.sol";
import "./MockMarket.sol";
import "./MockComptroller.sol";


contract MockAuction is MockState, MockComptroller, Auction, Market {
    constructor(address pool) MockComptroller(pool) public { }
    
    function stepE() external {
        Market.step();
    }

    function settleCouponAuctionE() external returns (bool) {
        return settleCouponAuction();
    }

    function cancelCouponAuctionAtEpochE(uint256 epoch) external {
        super.cancelCouponAuctionAtEpoch(epoch);
    }

    function finishCouponAuctionAtEpochE(uint256 epoch) external {
         super.finishCouponAuctionAtEpoch(epoch);
    }

    function initCouponAuctionE(address auction) external {
        super.initCouponAuction(auction);
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
}
