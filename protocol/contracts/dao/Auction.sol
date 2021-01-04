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

    event AuctionCouponPurchase(address indexed account, uint256 indexed epoch, uint256 dollarAmount, uint256 couponAmount);

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
            
            uint256 minMaturity = getCouponAuctionMinMaturity();
            uint256 maxMaturity = getCouponAuctionMaxMaturity();
            uint256 minYield = getCouponAuctionMinYield();
            uint256 maxYield = getCouponAuctionMaxYield();            
            
            // loop over bids and compute distance
            for (uint256 i = 0; i < getCouponAuctionBids(); i++) {
                uint256 couponMaturityEpoch = getCouponBidderState(getCouponBidderStateIndex(i)).couponMaturityEpoch;
                uint256 couponAmount = getCouponBidderState(getCouponBidderStateIndex(i)).couponAmount;
                uint256 dollarAmount = getCouponBidderState(getCouponBidderStateIndex(i)).dollarAmount;

                uint256 yieldRel = couponAmount.div(
                    dollarAmount
                ).div(
                    maxYield.sub(minYield)
                );
                uint256 maturityRel = couponMaturityEpoch.div(
                    maxMaturity.sub(minMaturity)
                );

                uint256 yieldRelSquared = Decimal.zero().add(yieldRel).pow(2).asUint256();
                uint256 maturityRelSquared = Decimal.zero().add(maturityRel).pow(2).asUint256();

                uint256 sumSquared = yieldRelSquared.add(maturityRelSquared);
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
                        uint256 epoch = epoch().add(bids[i].couponMaturityEpoch);
                        burnFromAccount(bids[i].bidder, bids[i].dollarAmount);
                        incrementBalanceOfCoupons(bids[i].bidder, epoch, bids[i].couponAmount);
                        emit AuctionCouponPurchase(bids[i].bidder, epoch, bids[i].dollarAmount, bids[i].couponAmount);
                        setCouponBidderStateSelected(bids[i].bidder);
                    }
                } else {
                    setCouponBidderStateRejected(bids[i].bidder);
                } 
            }
            return true;
        } else {
            return true;
        }        
    }
}