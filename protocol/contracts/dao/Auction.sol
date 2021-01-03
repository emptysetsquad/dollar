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

contract Auction is Comptroller {
    using SafeMath for uint256;

    event AuctionCouponPurchase(address indexed account, uint256 indexed epoch, uint256 dollarAmount, uint256 couponAmount);

    function sortBidsByDistance(Epoch.CouponBidderState[] bids) public constant internal returns(Epoch.CouponBidderState[]) {
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
                (arr[uint256(i)]., arr[uint256(j)]) = (arr[uint256(j)], arr[uint256(i)]);
                i++;
                j--;
            }
        }
        if (left < j)
            quickSort(arr, left, j);
        if (i < right)
            quickSort(arr, i, right);
    }

    function sqrt(uint256 x) internal returns (uint256 y) {
        uint256 z = x.add(1).div(2);
        y = x;
        while (z < y) {
            y = z;
            z = x.div(z.add(z)).div(2);
        }
    }

    function createCouponAuction() internal {
        Auction newAuction = new Auction(this);
        newAuction._totalBids = 0;
        newAuction.minMaturity = 1000000000000000000000000;
        newAuction.maxMaturity = 0;
        newAuction.minYield = 1000000000000000000000000;
        newAuction.maxYield = 0;
        setAuction(newAuction);
    }

    function cancelCouponAuction() internal returns (bool success) {
        // can only cancel previous auction when in next epoch
        cancelAuction(epoch() - 1);
        return true;
    }

    function settleCouponAuction() internal returns (bool success) {
        if (!isCouponAuctionFinished() && !isCouponAuctionCanceled()) {
            
            uint256 minMaturity = getMinMaturity();
            uint256 maxMaturity = getMaxMaturity();
            uint256 minYield = getMinYield();
            uint256 maxYield = getMaxYield();

            Epoch.CouponBidderState[] memory bids;
            
            // loop over bids and compute distance
            for (uint256 i = 0; i < getCouponAuctionBids(); i++) {
                uint256 couponMaturityEpoch = getCouponBidderState(getCouponBidderAtIndex(i)).couponMaturityEpoch;
                uint256 couponAmount = getCouponBidderState(getCouponBidderAtIndex(i)).couponAmount;
                uint256 dollarAmount = getCouponBidderState(getCouponBidderAtIndex(i)).dollarAmount;

                uint256 yieldRel = couponAmount.div(
                    dollarAmount
                ).div(
                    maxYield.sub(minYield)
                );
                uint256 maturityRel = couponMaturityEpoch.div(
                    maxMaturity.sub(minMaturity)
                );

                uint256 sumSquared = yieldRel.pow(2) + maturityRel.pow(2);
                uint256 distance = sqrt(sumSquared);
                getCouponBidderState(getCouponBidderAtIndex(i)).distance = distance;
                bids.push(getCouponBidderState(getCouponBidderAtIndex(i)).distance);
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
                        emit CouponPurchase(bids[i].bidder, epoch, dollarAmount, bids[i].couponAmount);
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