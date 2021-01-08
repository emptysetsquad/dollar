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

import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import "../token/IDollar.sol";
import "../oracle/IOracle.sol";
import "../external/Decimal.sol";

contract Account {
    enum Status {
        Frozen,
        Fluid,
        Locked
    }

    struct State {
        uint256 staged;
        uint256 balance;
        mapping(uint256 => uint256) coupons;
        mapping(address => uint256) couponAllowances;
        uint256 fluidUntil;
        uint256 lockedUntil;
    }
}

contract Epoch {
    struct Global {
        uint256 start;
        uint256 period;
        uint256 current;
    }

    struct Coupons {
        uint256 outstanding;
        uint256 expiration;
        uint256[] expiring;
    }

    struct CouponBidderState {
        bool selected;
        bool rejected;
        address bidder;
        uint256 dollarAmount;
        uint256 couponAmount;
        Decimal.D256 distance;
        uint256 couponExpiryEpoch;
    }

    struct AuctionState {
        bool isInit;
        bool canceled;
        bool finished;
        uint256 minExpiry;
        uint256 maxExpiry;
        uint256 minYield;
        uint256 maxYield;
        uint256 _totalBids;
        uint256 totalFilled;
        uint256 bidToCover;
        uint256 minYieldFilled;
        uint256 maxYieldFilled;
        uint256 avgYieldFilled;
        uint256 minExpiryFilled;
        uint256 maxExpiryFilled;
        uint256 avgExpiryFilled;
        uint256 minDollarAmount;
        uint256 maxDollarAmount;
        mapping(uint256 => address) couponBidder;
        mapping(address => CouponBidderState) couponBidderState;
    }

    struct State {
        uint256 bonded;
        Coupons coupons;
        AuctionState auction;
    }    
}

contract Candidate {
    enum Vote {
        UNDECIDED,
        APPROVE,
        REJECT
    }

    struct State {
        uint256 start;
        uint256 period;
        uint256 approve;
        uint256 reject;
        mapping(address => Vote) votes;
        bool initialized;
    }
}

contract Storage {
    struct Provider {
        IDollar dollar;
        IOracle oracle;
        address pool;
    }

    struct Balance {
        uint256 supply;
        uint256 bonded;
        uint256 staged;
        uint256 redeemable;
        uint256 debt;
        uint256 coupons;
    }

    struct State {
        Epoch.Global epoch;
        Balance balance;
        Provider provider;

        mapping(address => Account.State) accounts;
        mapping(uint256 => Epoch.State) epochs;
        mapping(address => Candidate.State) candidates;
    }
}

contract State {
    Storage.State _state;
}
