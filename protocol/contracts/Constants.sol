/*
    Copyright 2021 Universal Dollar Devs, based on the works of the Empty Set Squad

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

import "./external/Decimal.sol";

library Constants {
    /* Chain */
    uint256 private constant CHAIN_ID = 1; // Mainnet

    /* Bootstrapping */
    uint256 private constant BOOTSTRAPPING_PERIOD = 240; // 10 days with 1h per epoch
    uint256 private constant BOOTSTRAPPING_PRICE = 148e16; // 1.48 USDC

    /* Oracle */
    address private constant USDC = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    uint256 private constant ORACLE_RESERVE_MINIMUM = 1e10; // 10,000 USDC

    /* Bonding */
    uint256 private constant INITIAL_STAKE_MULTIPLE = 1e6; // 100 U8D -> 100M U8DS

    /* Epoch */
    struct EpochStrategy {
        uint256 offset;
        uint256 start;
        uint256 period;
    }

    uint256 private constant EPOCH_OFFSET = 0;
    uint256 private constant EPOCH_START = 1611360000; // 01/23/2021 @ 12:00am (UTC)
    uint256 private constant EPOCH_PERIOD = 1 hours;

    /* Governance */
    uint256 private constant GOVERNANCE_PERIOD = 48; // 48 epochs
    uint256 private constant GOVERNANCE_EXPIRATION = 16; // 16 + 1 epochs
    uint256 private constant GOVERNANCE_QUORUM = 20e16; // 20%
    uint256 private constant GOVERNANCE_PROPOSAL_THRESHOLD = 1e16; // 1%
    uint256 private constant GOVERNANCE_SUPER_MAJORITY = 66e16; // 66%
    uint256 private constant GOVERNANCE_EMERGENCY_DELAY = 12; // 12 epochs

    /* DAO */
    uint256 private constant ADVANCE_INCENTIVE = 50e18; // 50 U8D
    uint256 private constant DAO_EXIT_STREAM_PERIOD = 72 hours; // 3 days of DAO streaming

    uint256 private constant DAO_EXIT_MAX_BOOST = uint256(-1);  // infinity - without max boost
    uint256 private constant DAO_EXIT_BOOST_COEFFICIENT = 200e16; // 200% (x2) – DAO boosting coefficient for fast streaming
    uint256 private constant DAO_EXIT_BOOST_PENALTY = 25e16; // 25% – penalty for DAO stream boosting

    /* Pool */
    uint256 private constant POOL_LP_EXIT_STREAM_PERIOD = 36 hours; // 1.5 days of Pool LP streaming
    uint256 private constant POOL_REWARD_EXIT_STREAM_PERIOD = 36 hours; // 1.5 days of Pool Reward streaming

    uint256 private constant POOL_EXIT_MAX_BOOST = uint256(-1);  // infinity - without max boost
    uint256 private constant POOL_EXIT_BOOST_COEFFICIENT = 200e16; // 200% (x2) – Pool boosting coefficient for fast streaming
    uint256 private constant POOL_EXIT_BOOST_PENALTY = 25e16; // 25% – penalty for Pool stream boosting

    /* Market */
    uint256 private constant COUPON_EXPIRATION = 720;
    uint256 private constant DEBT_RATIO_CAP = 20e16; // 20%

    /* Regulator */
    uint256 private constant SUPPLY_CHANGE_LIMIT = 3e16; // 3%
    uint256 private constant SUPPLY_CHANGE_DIVISOR = 24e18; // 24
    uint256 private constant COUPON_SUPPLY_CHANGE_LIMIT = 6e16; // 6%
    uint256 private constant NEGATIVE_SUPPLY_CHANGE_DIVISOR = 12e18; // 12
    uint256 private constant ORACLE_POOL_RATIO = 30; // 30%
    uint256 private constant TREASURY_RATIO = 0; // 0%

    /* Not used */
    address private constant TREASURY_ADDRESS = address(0); // no treasury address

    /**
     * Getters
     */

    function getUsdcAddress() internal pure returns (address) {
        return USDC;
    }

    function getOracleReserveMinimum() internal pure returns (uint256) {
        return ORACLE_RESERVE_MINIMUM;
    }

    function getEpochStrategy() internal pure returns (EpochStrategy memory) {
        return EpochStrategy({
            offset: EPOCH_OFFSET,
            start: EPOCH_START,
            period: EPOCH_PERIOD
        });
    }

    function getInitialStakeMultiple() internal pure returns (uint256) {
        return INITIAL_STAKE_MULTIPLE;
    }

    function getBootstrappingPeriod() internal pure returns (uint256) {
        return BOOTSTRAPPING_PERIOD;
    }

    function getBootstrappingPrice() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: BOOTSTRAPPING_PRICE});
    }

    function getGovernancePeriod() internal pure returns (uint256) {
        return GOVERNANCE_PERIOD;
    }

    function getGovernanceExpiration() internal pure returns (uint256) {
        return GOVERNANCE_EXPIRATION;
    }

    function getGovernanceQuorum() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: GOVERNANCE_QUORUM});
    }

    function getGovernanceProposalThreshold() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: GOVERNANCE_PROPOSAL_THRESHOLD});
    }

    function getGovernanceSuperMajority() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: GOVERNANCE_SUPER_MAJORITY});
    }

    function getGovernanceEmergencyDelay() internal pure returns (uint256) {
        return GOVERNANCE_EMERGENCY_DELAY;
    }

    function getAdvanceIncentive() internal pure returns (uint256) {
        return ADVANCE_INCENTIVE;
    }

    /* DAO */

    function getDAOExitStreamPeriod() internal pure returns (uint256) {
        return DAO_EXIT_STREAM_PERIOD;
    }

    function getDAOExitMaxBoost() internal pure returns (uint256) {
        return DAO_EXIT_MAX_BOOST;
    }

    function getDAOExitBoostCoefficient() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: DAO_EXIT_BOOST_COEFFICIENT});
    }

    function getDAOExitBoostPenalty() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: DAO_EXIT_BOOST_PENALTY});
    }

    /* Pool */

    function getPoolLpExitStreamPeriod() internal pure returns (uint256) {
        return POOL_LP_EXIT_STREAM_PERIOD;
    }

    function getPoolRewardExitStreamPeriod() internal pure returns (uint256) {
        return POOL_REWARD_EXIT_STREAM_PERIOD;
    }

    function getPoolExitMaxBoost() internal pure returns (uint256) {
        return POOL_EXIT_MAX_BOOST;
    }

    function getPoolExitBoostCoefficient() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: POOL_EXIT_BOOST_COEFFICIENT});
    }

    function getPoolExitBoostPenalty() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: POOL_EXIT_BOOST_PENALTY});
    }

    function getCouponExpiration() internal pure returns (uint256) {
        return COUPON_EXPIRATION;
    }

    function getDebtRatioCap() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: DEBT_RATIO_CAP});
    }

    function getSupplyChangeLimit() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: SUPPLY_CHANGE_LIMIT});
    }

    function getSupplyChangeDivisor() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: SUPPLY_CHANGE_DIVISOR});
    }

    function getCouponSupplyChangeLimit() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: COUPON_SUPPLY_CHANGE_LIMIT});
    }

    function getNegativeSupplyChangeDivisor() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: NEGATIVE_SUPPLY_CHANGE_DIVISOR});
    }

    function getOraclePoolRatio() internal pure returns (uint256) {
        return ORACLE_POOL_RATIO;
    }

    function getTreasuryRatio() internal pure returns (uint256) {
        return TREASURY_RATIO;
    }

    function getChainId() internal pure returns (uint256) {
        return CHAIN_ID;
    }

    function getTreasuryAddress() internal pure returns (address) {
        return TREASURY_ADDRESS;
    }
}
