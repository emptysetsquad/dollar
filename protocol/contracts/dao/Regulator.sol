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
import "../external/Decimal.sol";
import "../Constants.sol";

contract Regulator is Comptroller {
    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    bytes32 private constant FILE = "Regulator";
    Epoch.CouponBidderState[] private bids;
    uint256 private totalFilled = 0;
    uint256 private maxExpiryFilled = 0;
    uint256 private sumExpiryFilled = 0;
    uint256 private sumYieldFilled = 0;
    uint256 private minExpiryFilled = 2**256 - 1;
    Decimal.D256 private maxYieldFilled = Decimal.zero();
    Decimal.D256 private minYieldFilled = Decimal.D256(2**256 - 1);

    event SupplyIncrease(uint256 indexed epoch, uint256 price, uint256 newRedeemable, uint256 lessDebt, uint256 newBonded);
    event SupplyDecrease(uint256 indexed epoch, uint256 price, uint256 newDebt);
    event SupplyNeutral(uint256 indexed epoch);

    function step() internal {
        Decimal.D256 memory price = oracleCapture();

        //need to check previous epoch because by the time the Regulator.step function is fired, Bonding.step may have already incremented the epoch
        Epoch.AuctionState storage auction = getCouponAuctionAtEpoch(epoch() - 1);

        if (price.greaterThan(Decimal.one())) {
            //check for outstanding auction, if exists cancel it
            if (auction.isInit == true){
                cancelCouponAuctionAtEpoch(epoch() - 1);
            }

            growSupply(price);
            return;
        }

        if (price.lessThan(Decimal.one())) {
            //check for outstanding auction, if exists settle it and start a new one
            if (auction.isInit == true){
                bool isAuctionSettled = settleCouponAuction();
                finishCouponAuctionAtEpoch(epoch() - 1);
            }
            initCouponAuction();
            
            shrinkSupply(price);
            return;
        }

        emit SupplyNeutral(epoch());
    }

    function shrinkSupply(Decimal.D256 memory price) private {
        Decimal.D256 memory delta = limit(Decimal.one().sub(price), price);
        uint256 newDebt = delta.mul(totalNet()).asUint256();
        uint256 cappedNewDebt = increaseDebt(newDebt);

        emit SupplyDecrease(epoch(), price.value, cappedNewDebt);
        return;
    }

    function growSupply(Decimal.D256 memory price) private {
        uint256 lessDebt = resetDebt(Decimal.zero());

        Decimal.D256 memory delta = limit(price.sub(Decimal.one()), price);
        uint256 newSupply = delta.mul(totalNet()).asUint256();
        (uint256 newRedeemable, uint256 newBonded) = increaseSupply(newSupply);
        emit SupplyIncrease(epoch(), price.value, newRedeemable, lessDebt, newBonded);
    }

    function limit(Decimal.D256 memory delta, Decimal.D256 memory price) private view returns (Decimal.D256 memory) {

        Decimal.D256 memory supplyChangeLimit = Constants.getSupplyChangeLimit();
        
        uint256 totalRedeemable = totalRedeemable();
        uint256 totalCoupons = totalCoupons();
        if (price.greaterThan(Decimal.one()) && (totalRedeemable < totalCoupons)) {
            supplyChangeLimit = Constants.getCouponSupplyChangeLimit();
        }

        return delta.greaterThan(supplyChangeLimit) ? supplyChangeLimit : delta;

    }

    function oracleCapture() private returns (Decimal.D256 memory) {
        (Decimal.D256 memory price, bool valid) = oracle().capture();

        if (bootstrappingAt(epoch().sub(1))) {
            return Constants.getBootstrappingPrice();
        }
        if (!valid) {
            return Decimal.one();
        }

        return price;
    }    

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

    function settleCouponAuction(uint256 settlementEpoch) internal returns (bool success) {
        if (!isCouponAuctionFinished(settlementEpoch) && !isCouponAuctionCanceled(settlementEpoch)) {
            yieldRelNorm = getCouponAuctionMaxYield(settlementEpoch) - getCouponAuctionMinYield(settlementEpoch);
            expiryRelNorm = getCouponAuctionMaxExpiry(settlementEpoch) - getCouponAuctionMinExpiry(settlementEpoch);    
            dollarRelNorm = getCouponAuctionMaxDollarAmount(settlementEpoch) - getCouponAuctionMinDollarAmount(settlementEpoch);
            
            // loop over bids and compute distance
            for (uint256 i = 0; i < getCouponAuctionBids(settlementEpoch); i++) {
                Epoch.CouponBidderState storage bidder = getCouponBidderState(settlementEpoch, getCouponBidderStateIndex(settlementEpoch, i));
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

                setCouponBidderStateDistance(settlementEpoch, getCouponBidderStateIndex(settlementEpoch, i), distance);
                bidder = getCouponBidderState(settlementEpoch, getCouponBidderStateIndex(settlementEpoch, i));
                bids.push(bidder);
            }

            
            // sort bids
            bids = sortBidsByDistance(bids);

            // assign coupons until totalDebt filled, reject the rest
            for (uint256 i = 0; i < bids.length; i++) {
                if (totalDebt() >= bids[i].dollarAmount) {
                    if (!getCouponBidderStateRejected(settlementEpoch, bids[i].bidder) && !getCouponBidderStateRejected(settlementEpoch, bids[i].bidder)) {
                        Decimal.D256 memory yield = Decimal.ratio(
                            bids[i].couponAmount,
                            bids[i].dollarAmount
                        );

                        //must check again if account is able to be assigned
                        if (acceptableBidCheck(bids[i].bidder, bids[i].dollarAmount)){
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
                            
                            sumYieldFilled += yield.asUint256();
                            sumExpiryFilled += bids[i].couponExpiryEpoch;
                            totalAuctioned += bids[i].couponAmount;
                            totalBurned += bids[i].dollarAmount;
                            
                            uint256 epochExpiry = epoch().add(bids[i].couponExpiryEpoch);
                            burnFromAccount(bids[i].bidder, bids[i].dollarAmount);
                            incrementBalanceOfCoupons(bids[i].bidder, epochExpiry, bids[i].couponAmount);
                            setCouponBidderStateSelected(settlementEpoch, bids[i].bidder, i);
                            totalFilled++;
                        } else {
                            setCouponBidderStateRejected(settlementEpoch, bids[i].bidder);
                        }
                    }
                } else {
                    /* setCouponBidderStateRejected(settlementEpoch, bids[i].bidder); or just break and close the auction */
                    break;
                } 
            }

            // set auction internals
            if (totalFilled > 0) {
                Decimal.D256 memory avgYieldFilled = Decimal.ratio(
                    sumYieldFilled,
                    totalFilled
                );
                Decimal.D256 memory avgExpiryFilled = Decimal.ratio(
                    sumExpiryFilled,
                    totalFilled
                );

                //mul(100) to avoid sub 0 results
                Decimal.D256 memory bidToCover = Decimal.ratio(
                    bids.length,
                    totalFilled
                ).mul(100);

                setMinExpiryFilled(settlementEpoch, minExpiryFilled);
                setMaxExpiryFilled(settlementEpoch, maxExpiryFilled);
                setAvgExpiryFilled(settlementEpoch, avgExpiryFilled.asUint256());
                setMinYieldFilled(settlementEpoch, minYieldFilled.asUint256());
                setMaxYieldFilled(settlementEpoch, maxYieldFilled.asUint256());
                setAvgYieldFilled(settlementEpoch, avgYieldFilled.asUint256());
                setBidToCover(settlementEpoch, bidToCover.asUint256());
                setTotalFilled(settlementEpoch, totalFilled);
                setTotalAuctioned(settlementEpoch, totalAuctioned);
                setTotalBurned(settlementEpoch, totalBurned);
            }

            //clear bids and reset vars
            delete bids;
            totalFilled = 0;
            totalBurned = 0;
            yieldRelNorm = 1;
            expiryRelNorm = 1;
            dollarRelNorm = 1;
            totalAuctioned = 0;
            maxExpiryFilled = 0;
            sumExpiryFilled = 0;
            sumYieldFilled = 0;
            minExpiryFilled = 2**256 - 1;
            maxYieldFilled = Decimal.zero();
            minYieldFilled = Decimal.D256(2**256 - 1);

            return true;
        } else {
            return false;
        }        
    }
}
