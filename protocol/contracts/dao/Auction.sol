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
import "./Market.sol";
import "../Constants.sol";
import "../external/Decimal.sol";

contract Auction is Comptroller {
    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    bytes32 private constant FILE = "Auction";

    Epoch.CouponBidderState[] private bids;

    uint256 private totalFilled = 0;
    uint256 private minExpiryFilled = 2**256 - 1;
    uint256 private maxExpiryFilled = 0;
    uint256 private sumExpiryFilled = 0;
    Decimal.D256 private minYieldFilled = Decimal.D256(2**256 - 1);
    Decimal.D256 private maxYieldFilled = Decimal.zero();
    Decimal.D256 private sumYieldFilled = Decimal.zero();

    function sortBidsByDistance(Epoch.CouponBidderState[] storage bids) internal returns(Epoch.CouponBidderState[] storage) {
       quickSort(bids, int(0), int(bids.length - 1));
       return bids;
    }
    
    function quickSort(Epoch.CouponBidderState[] memory arr, int left, int right) internal {
        int i = left;
        int j = right;
        if(i==j) return;
        Decimal.D256 memory pivot = arr[uint256(left + (right - left) / 2)].distance;
        while (i <= j) {
            while (arr[uint256(i)].distance.lessThan(pivot)) i++;
            while (pivot.lessThan(arr[uint256(j)].distance)) j--;
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

    function sqrt(Decimal.D256 memory x) internal pure returns (Decimal.D256 memory y) {
        Decimal.D256 memory z = x.add(1).div(2);
        y = x;
        while (z.lessThan(y)) {
            y = z;
            z = x.div(z.add(z)).div(2);
        }
        return y;
    }

    function settleCouponAuction() internal returns (bool success) {
        if (!isCouponAuctionFinished() && !isCouponAuctionCanceled()) {
            uint256 yieldRelNorm = getCouponAuctionMaxYield() - getCouponAuctionMinYield();
            uint256 expiryRelNorm = getCouponAuctionMaxExpiry() - getCouponAuctionMinExpiry();    
            uint256 dollarRelNorm = getCouponAuctionMaxDollarAmount() - getCouponAuctionMinDollarAmount();
            
            // loop over bids and compute distance
            for (uint256 i = 0; i < getCouponAuctionBids(); i++) {
                Epoch.CouponBidderState storage bidder = getCouponBidderState(getCouponBidderStateIndex(i));
                Decimal.D256 memory yieldRel = Decimal.ratio(
                    Decimal.ratio(
                        bidder.couponAmount,
                        bidder.dollarAmount
                    ).asUint256(),
                    yieldRelNorm
                );
                
                Decimal.D256 memory expiryRel = Decimal.ratio(
                    bidder.couponExpiryEpoch,
                    expiryRelNorm
                );
                
                Decimal.D256 memory dollarRelMax = Decimal.ratio(
                    bidder.dollarAmount,
                    dollarRelNorm
                );
                Decimal.D256 memory dollarRel = (Decimal.one().add(Decimal.one())).sub(dollarRelMax);

                Decimal.D256 memory yieldRelSquared = yieldRel.pow(2);
                Decimal.D256 memory expiryRelSquared = expiryRel.pow(2);
                Decimal.D256 memory dollarRelSquared = dollarRel.pow(2);

                Decimal.D256 memory sumOfSquared = yieldRelSquared.add(expiryRelSquared).add(dollarRelSquared);
                Decimal.D256 memory distance;
                if (sumOfSquared.greaterThan(Decimal.zero())) {
                    distance = sqrt(sumOfSquared);
                } else {
                    distance = Decimal.zero();
                }

                setCouponBidderStateDistance(getCouponBidderStateIndex(i), distance);
                bidder = getCouponBidderState(getCouponBidderStateIndex(i));
                bids.push(bidder);
            }

            
            // sort bids
            bids = sortBidsByDistance(bids);

            // assign coupons until totalDebt filled, reject the rest
            for (uint256 i = 0; i < bids.length; i++) {
                if (totalDebt() >= bids[i].dollarAmount) {
                    if (!getCouponBidderStateRejected(bids[i].bidder) && !getCouponBidderStateRejected(bids[i].bidder)) {
                        Decimal.D256 memory yield = Decimal.ratio(
                            bids[i].couponAmount,
                            bids[i].dollarAmount
                        );
                        
                        if (yield.lessThan(minYieldFilled)) {
                            minYieldFilled = yield;
                        } else if (yield.greaterThan(maxYieldFilled)) {
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
                    /* setCouponBidderStateRejected(bids[i].bidder); or just break and close the auction */
                    break;
                } 
            }

            // set auction internals
            if (totalFilled > 0) {
                Decimal.D256 memory avgYieldFilled = Decimal.ratio(
                    sumYieldFilled.asUint256(),
                    totalFilled
                );
                Decimal.D256 memory avgExpiryFilled = Decimal.ratio(
                    sumExpiryFilled,
                    totalFilled
                );
                Decimal.D256 memory bidToCover = Decimal.ratio(
                    bids.length,
                    totalFilled
                );

                setMinExpiryFilled(minExpiryFilled);
                setMaxExpiryFilled(maxExpiryFilled);
                setAvgExpiryFilled(avgExpiryFilled.asUint256());
                setMinYieldFilled(minYieldFilled.asUint256());
                setMaxYieldFilled(maxYieldFilled.asUint256());
                setAvgYieldFilled(avgYieldFilled.asUint256());
                setBidToCover(bidToCover.asUint256());
                setTotalFilled(totalFilled);
            }
            

            return true;
        } else {
            return false;
        }        
    }
}