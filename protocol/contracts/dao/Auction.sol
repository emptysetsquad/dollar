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
import "./Comptroller.sol";
import "../Constants.sol";
import "../external/Decimal.sol";

contract Auction is Comptroller {
    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    Epoch.CouponBidderState[] private bids;

    uint256 private totalFilled = 0;
    uint256 private minExpiryFilled = 10000000000000000000;
    uint256 private maxExpiryFilled = 0;
    uint256 private sumExpiryFilled = 0;
    uint256 private minYieldFilled = 10000000000000000000;
    uint256 private maxYieldFilled = 0;
    uint256 private sumYieldFilled = 0;

    function sortBidsByDistance(Epoch.CouponBidderState[] memory bids) internal returns(Epoch.CouponBidderState[] memory) {
       quickSort(bids, uint256(0), uint256(bids.length - 1));
       return bids;
    }
    
    function quickSort(Epoch.CouponBidderState[] memory arr, uint256 left, uint256 right) internal {
        uint256 i = left;
        uint256 j = right;
        if(i==j) return;
        uint256 pivot = arr[uint256(left + (right - left) / 2)].distance;
        while (i <= j) {
            while (arr[uint256(i)].distance < pivot) i++;
            while (pivot < arr[uint256(j)].distance) j--;
            if (i <= j) {
                (arr[uint256(i)], arr[uint256(j)]) = (arr[uint256(j)], arr[uint256(i)]);
                i++;
                j--;
            }
        }
        if (left < j)
            quickSort(arr, left, j);
        if (i < right)
            quickSort(arr, i, right);
    }

    function sqrt(uint256 x) internal pure returns (uint256 y) {
        uint256 z = x.add(1).div(2);
        y = x;
        while (z < y) {
            y = z;
            z = x.div(z.add(z)).div(2);
        }
    }

    function settleCouponAuction() public returns (bool success) {
        if (!isCouponAuctionFinished() && !isCouponAuctionCanceled()) {
            
            uint256 minExpiry = getCouponAuctionMinExpiry();
            uint256 maxExpiry = getCouponAuctionMaxExpiry();
            uint256 minYield = getCouponAuctionMinYield();
            uint256 maxYield = getCouponAuctionMaxYield(); 
            uint256 minDollarAmount = getCouponAuctionMinDollarAmount();
            uint256 maxDollarAmount = getCouponAuctionMinDollarAmount();            
            
            // loop over bids and compute distance
            for (uint256 i = 0; i < getCouponAuctionBids(); i++) {
                uint256 couponExpiryEpoch = getCouponBidderState(getCouponBidderStateIndex(i)).couponExpiryEpoch;
                uint256 couponAmount = getCouponBidderState(getCouponBidderStateIndex(i)).couponAmount;
                uint256 dollarAmount = getCouponBidderState(getCouponBidderStateIndex(i)).dollarAmount;

                uint256 yieldRel = couponAmount.div(
                    dollarAmount
                ).div(
                    maxYield.sub(minYield)
                );
                uint256 ExpiryRel = couponExpiryEpoch.div(
                    maxExpiry.sub(minExpiry)
                );
                uint256 dollarRelMax = dollarAmount.div(
                    maxDollarAmount.sub(minDollarAmount)
                );
                uint256 dollarRel = Decimal.one().sub(dollarRelMax).asUint256();

                uint256 yieldRelSquared = Decimal.zero().add(yieldRel).pow(2).asUint256();
                uint256 ExpiryRelSquared = Decimal.zero().add(ExpiryRel).pow(2).asUint256();
                uint256 dollarRelSquared = Decimal.zero().add(dollarRel).pow(2).asUint256();

                uint256 sumSquared = yieldRelSquared.add(ExpiryRelSquared).add(dollarRelSquared);
                uint256 distance = sqrt(sumSquared);
                getCouponBidderState(getCouponBidderStateIndex(i)).distance = distance;
                bids.push(getCouponBidderState(getCouponBidderStateIndex(i)));
            }

            // sort bids
            sortBidsByDistance(bids);

            

            // assign coupons until totalDebt filled, reject the rest
            for (uint256 i = 0; i < bids.length; i++) {
                if (totalDebt() >= bids[i].dollarAmount) {
                    if (!getCouponBidderStateRejected(bids[i].bidder) && !getCouponBidderStateRejected(bids[i].bidder)) {
                        uint256 yield = bids[i].couponAmount.div(
                            bids[i].dollarAmount
                        );
                        
                        if (yield < minYieldFilled) {
                            minYieldFilled = yield;
                        } else if (yield > maxYieldFilled) {
                            maxYieldFilled = yield;
                        }

                        if (bids[i].couponExpiryEpoch < minExpiryFilled) {
                            minExpiryFilled = bids[i].couponExpiryEpoch;
                        } else if (bids[i].couponExpiryEpoch > maxExpiryFilled) {
                            maxExpiryFilled = bids[i].couponExpiryEpoch;
                        }
                        
                        sumYieldFilled.add(yield);
                        sumExpiryFilled.add(bids[i].couponExpiryEpoch);
                        
                        uint256 epoch = epoch().add(bids[i].couponExpiryEpoch);
                        burnFromAccount(bids[i].bidder, bids[i].dollarAmount);
                        incrementBalanceOfCoupons(bids[i].bidder, epoch, bids[i].couponAmount);
                        setCouponBidderStateSelected(bids[i].bidder);
                        totalFilled++;
                    }
                } else {
                    setCouponBidderStateRejected(bids[i].bidder);
                } 
            }

            // set auction internals
            uint256 avgYieldFilled = sumYieldFilled.div(totalFilled);
            uint256 avgExpiryFilled = sumExpiryFilled.div(totalFilled);
            uint256 bidToCover = bids.length.div(totalFilled);

            setMinExpiryFilled(minExpiryFilled);
            setMaxExpiryFilled(maxExpiryFilled);
            setAvgExpiryFilled(avgExpiryFilled);
            setMinYieldFilled(minYieldFilled);
            setMaxYieldFilled(maxYieldFilled);
            setAvgYieldFilled(avgYieldFilled);
            setBidToCover(bidToCover);
            setTotalFilled(totalFilled);

            return true;
        } else {
            return false;
        }        
    }
}