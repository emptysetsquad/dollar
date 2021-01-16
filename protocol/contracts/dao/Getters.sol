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
import "./State.sol";
import "../Constants.sol";

contract Getters is State {
    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    /**
     * ERC20 Interface
     */

    function name() public view returns (string memory) {
        return "Empty Set Dollar Stake";
    }

    function symbol() public view returns (string memory) {
        return "ESDS";
    }

    function decimals() public view returns (uint8) {
        return 18;
    }

    function balanceOf(address account) public view returns (uint256) {
        return _state.accounts[account].balance;
    }

    function totalSupply() public view returns (uint256) {
        return _state.balance.supply;
    }

    function allowance(address owner, address spender) external view returns (uint256) {
        return 0;
    }

    /**
     * Global
     */

    function dollar() public view returns (IDollar) {
        return _state.provider.dollar;
    }

    function oracle() public view returns (IOracle) {
        return _state.provider.oracle;
    }

    function pool() public view returns (address) {
        return _state.provider.pool;
    }

    function totalBonded() public view returns (uint256) {
        return _state.balance.bonded;
    }

    function totalStaged() public view returns (uint256) {
        return _state.balance.staged;
    }

    function totalDebt() public view returns (uint256) {
        return _state.balance.debt;
    }

    function totalRedeemable() public view returns (uint256) {
        return _state.balance.redeemable;
    }

    function totalCoupons() public view returns (uint256) {
        return _state.balance.coupons;
    }

    function totalNet() public view returns (uint256) {
        return dollar().totalSupply().sub(totalDebt());
    }

    /**
     * Account
     */

    function balanceOfStaged(address account) public view returns (uint256) {
        return _state.accounts[account].staged;
    }

    function balanceOfBonded(address account) public view returns (uint256) {
        uint256 totalSupply = totalSupply();
        if (totalSupply == 0) {
            return 0;
        }
        return totalBonded().mul(balanceOf(account)).div(totalSupply);
    }

    function balanceOfCoupons(address account, uint256 epoch) public view returns (uint256) {
        if (outstandingCoupons(epoch) == 0) {
            return 0;
        }
        return _state.accounts[account].coupons[epoch];
    }

    function statusOf(address account) public view returns (Account.Status) {
        if (_state.accounts[account].lockedUntil > epoch()) {
            return Account.Status.Locked;
        }

        return epoch() >= _state.accounts[account].fluidUntil ? Account.Status.Frozen : Account.Status.Fluid;
    }

    function fluidUntil(address account) public view returns (uint256) {
        return _state.accounts[account].fluidUntil;
    }

    function lockedUntil(address account) public view returns (uint256) {
        return _state.accounts[account].lockedUntil;
    }

    function allowanceCoupons(address owner, address spender) public view returns (uint256) {
        return _state.accounts[owner].couponAllowances[spender];
    }

    /**
     * Epoch
     */

    function epoch() public view returns (uint256) {
        return _state.epoch.current;
    }

    function epochTime() public view returns (uint256) {
        Constants.EpochStrategy memory current = Constants.getCurrentEpochStrategy();
        Constants.EpochStrategy memory previous = Constants.getPreviousEpochStrategy();

        return blockTimestamp() < current.start ?
            epochTimeWithStrategy(previous) :
            epochTimeWithStrategy(current);
    }

    function epochTimeWithStrategy(Constants.EpochStrategy memory strategy) private view returns (uint256) {
        return blockTimestamp()
            .sub(strategy.start)
            .div(strategy.period)
            .add(strategy.offset);
    }

    // Overridable for testing
    function blockTimestamp() internal view returns (uint256) {
        return block.timestamp;
    }

    function outstandingCoupons(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].coupons.outstanding;
    }

    function couponsExpiration(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].coupons.expiration;
    }

    function expiringCoupons(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].coupons.expiring.length;
    }

    function expiringCouponsAtIndex(uint256 epoch, uint256 i) public view returns (uint256) {
        return _state.epochs[epoch].coupons.expiring[i];
    }

    function totalBondedAt(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].bonded;
    }

    function bootstrappingAt(uint256 epoch) public view returns (bool) {
        return epoch <= Constants.getBootstrappingPeriod();
    }

    function getCouponAuctionAtEpoch(uint256 epoch) internal view returns (Epoch.AuctionState storage) {
        return _state.epochs[epoch].auction;
    }
    
    function getCouponAuctionBids(uint256 epoch) internal view returns (uint256) {
        return _state.epochs[epoch].auction._totalBids;
    }

    function getCouponBidderState(uint256 epoch, address bidder) internal view returns (Epoch.CouponBidderState storage) {
        return _state.epochs[epoch].auction.couponBidderState[bidder];
    }

    function getCouponBidderStateSelected(uint256 epoch, address bidder) internal view returns (bool) {
        return _state.epochs[epoch].auction.couponBidderState[bidder].selected;
    }

    function getCouponBidderStateAssginedAtIndex(uint256 epoch, uint256 index) internal view returns (address) {
        return _state.epochs[epoch].auction.seletedCouponBidder[index];
    }

    function getCouponBidderStateRejected(uint256 epoch, address bidder) internal view returns (bool) {
        return _state.epochs[epoch].auction.couponBidderState[bidder].rejected;
    }

    function getCouponBidderStateIndex(uint256 epoch, uint256 index) internal view returns (address) {
        return _state.epochs[epoch].auction.couponBidder[index];
    }

    function isCouponAuctionFinished(uint256 epoch) internal view returns (bool){
        return _state.epochs[epoch].auction.finished;
    }

    function isCouponAuctionCanceled(uint256 epoch) internal view returns (bool){
        return _state.epochs[epoch].auction.canceled;
    }

    function getCouponAuctionMinExpiry(uint256 epoch) internal view returns (uint256) {
        return _state.epochs[epoch].auction.minExpiry;
    }

    function getCouponAuctionMaxExpiry(uint256 epoch) internal view returns (uint256) {
        return _state.epochs[epoch].auction.maxExpiry;
    }

    function getCouponAuctionMinYield(uint256 epoch) internal view returns (uint256) {
        return _state.epochs[epoch].auction.minYield;
    }

    function getCouponAuctionMaxYield(uint256 epoch) internal view returns (uint256) {
        return _state.epochs[epoch].auction.maxYield;
    }

    function getCouponAuctionMinDollarAmount(uint256 epoch) internal view returns (uint256) {
        return _state.epochs[epoch].auction.minDollarAmount;
    }

    function getCouponAuctionMaxDollarAmount(uint256 epoch) internal view returns (uint256) {
        return _state.epochs[epoch].auction.maxDollarAmount;
    }

    function getMinExpiryFilled(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].auction.minExpiryFilled;
    }
    
    function getMaxExpiryFilled(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].auction.maxExpiryFilled;
    }
    
    function getAvgExpiryFilled(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].auction.avgExpiryFilled;
    }
    
    function getMinYieldFilled(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].auction.minYieldFilled;
    }
    
    function getMaxYieldFilled(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].auction.maxYieldFilled;
    }
    
    function getAvgYieldFilled(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].auction.avgYieldFilled;
    }
    
    function getBidToCover(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].auction.bidToCover;
    }
    
    function getTotalFilled(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].auction.totalFilled;
    }

    function getTotalAuctioned(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].auction.totalAuctioned;
    }

    function getTotalBurned(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].auction.totalBurned;
    }

    function getEarliestDeadAuctionEpoch() public view returns (uint256) {
        return _state.epoch.earliestDeadAuction;
    }

    function getLatestCouponAuctionRedeemedSelectedBidderIndex(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].auction.latestRedeemedSelectedBidderIndex;
    }

    function getAvgAvgYieldAcrossCouponAuctions() public view returns (uint256) {
        // loop over past epochs from the latest `dead` epoch to the current
        uint256 sumYield = 0;
        uint256 totalAvailableAuctions = 1;
        for (uint256 d_idx = getEarliestDeadAuctionEpoch(); d_idx < uint256(epoch()); d_idx++) {
            uint256 temp_coupon_auction_epoch = d_idx;
            Epoch.AuctionState storage auction = getCouponAuctionAtEpoch(temp_coupon_auction_epoch);
            // skip auctions that have been canceled, dead or not finished auction present?
            if (!auction.canceled && !auction.dead && auction.isInit && !auction.finished) {
                sumYield += getAvgYieldFilled(temp_coupon_auction_epoch);
                totalAvailableAuctions++;
            }
        }

        return sumYield.div(totalAvailableAuctions);
    }

    /**
     * Governance
     */

    function recordedVote(address account, address candidate) public view returns (Candidate.Vote) {
        return _state.candidates[candidate].votes[account];
    }

    function startFor(address candidate) public view returns (uint256) {
        return _state.candidates[candidate].start;
    }

    function periodFor(address candidate) public view returns (uint256) {
        return _state.candidates[candidate].period;
    }

    function approveFor(address candidate) public view returns (uint256) {
        return _state.candidates[candidate].approve;
    }

    function rejectFor(address candidate) public view returns (uint256) {
        return _state.candidates[candidate].reject;
    }

    function votesFor(address candidate) public view returns (uint256) {
        return approveFor(candidate).add(rejectFor(candidate));
    }

    function isNominated(address candidate) public view returns (bool) {
        return _state.candidates[candidate].start > 0;
    }

    function isInitialized(address candidate) public view returns (bool) {
        return _state.candidates[candidate].initialized;
    }

    function implementation() public view returns (address impl) {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            impl := sload(slot)
        }
    }
}
