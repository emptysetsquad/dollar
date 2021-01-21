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

import "./external/Decimal.sol";

library Constants {
    /* Chain */
    uint256 private constant CHAIN_ID = 1; // Mainnet

    /* Bootstrapping */
    uint256 private constant BOOTSTRAPPING_PERIOD = 90;
    uint256 private constant BOOTSTRAPPING_PRICE = 11e17; // 1.10 USDC
    uint256 private constant BOOTSTRAPPING_SPEEDUP_FACTOR = 3; // 30 days @ 8 hours

    /* Oracle */
    address private constant USDC = address(0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48);
    uint256 private constant ORACLE_RESERVE_MINIMUM = 1e10; // 10,000 USDC

    /* Bonding */
    uint256 private constant INITIAL_STAKE_MULTIPLE = 1e6; // 100 ESD -> 100M ESDS

    /* Epoch */
    struct EpochStrategy {
        uint256 offset;
        uint256 start;
        uint256 period;
    }

    uint256 private constant PREVIOUS_EPOCH_OFFSET = 91;
    uint256 private constant PREVIOUS_EPOCH_START = 1600905600;
    uint256 private constant PREVIOUS_EPOCH_PERIOD = 86400;

    uint256 private constant CURRENT_EPOCH_OFFSET = 106;
    uint256 private constant CURRENT_EPOCH_START = 1602201600;
    uint256 private constant CURRENT_EPOCH_PERIOD = 28800;

    /* Governance */
    uint256 private constant GOVERNANCE_PERIOD = 9; // 9 epochs
    uint256 private constant GOVERNANCE_EXPIRATION = 2; // 2 + 1 epochs
    uint256 private constant GOVERNANCE_QUORUM = 20e16; // 20%
    uint256 private constant GOVERNANCE_PROPOSAL_THRESHOLD = 5e15; // 0.5%
    uint256 private constant GOVERNANCE_SUPER_MAJORITY = 40e16; // 40%
    uint256 private constant GOVERNANCE_EMERGENCY_DELAY = 6; // 6 epochs

    /* DAO */
    uint256 private constant ADVANCE_INCENTIVE = 1e21; // 1000 ESD
    uint256 private constant DAO_EXIT_LOCKUP_EPOCHS = 15; // 15 epochs fluid

    /* Pool */
    uint256 private constant POOL_EXIT_LOCKUP_EPOCHS = 5; // 5 epochs fluid

    /* Market */
    uint256 private constant COUPON_EXPIRATION = 90;
    uint256 private constant DEBT_RATIO_CAP = 20e16; // 20%
    uint256 private constant COUPON_PRORATED_START = 420; // epoch 420

    /* Regulator */
    uint256 private constant SUPPLY_CHANGE_LIMIT = 3e16; // 3%
    uint256 private constant COUPON_SUPPLY_CHANGE_LIMIT = 6e16; // 6%
    uint256 private constant ORACLE_POOL_RATIO = 20; // 20%
    uint256 private constant TREASURY_RATIO = 250; // 2.5%
    uint256 private constant STABILITY_REWARD_MIN = 0.3e14; // 0.3 bps
    uint256 private constant STABILITY_REWARD_RATE = 5e14; // 5 bps

    /* Deployed */
    address private constant DAO_ADDRESS = address(0x443D2f2755DB5942601fa062Cc248aAA153313D3);
    address private constant DOLLAR_ADDRESS = address(0x36F3FD68E7325a35EB768F1AedaAe9EA0689d723);
    address private constant PAIR_ADDRESS = address(0x88ff79eB2Bc5850F27315415da8685282C7610F9);
    address private constant TREASURY_ADDRESS = address(0x460661bd4A5364A3ABCc9cfc4a8cE7038d05Ea22);

    /**
     * Getters
     */

    function getUsdcAddress() internal pure returns (address) {
        return USDC;
    }

    function getOracleReserveMinimum() internal pure returns (uint256) {
        return ORACLE_RESERVE_MINIMUM;
    }

    function getPreviousEpochStrategy() internal pure returns (EpochStrategy memory) {
        return EpochStrategy({
            offset: PREVIOUS_EPOCH_OFFSET,
            start: PREVIOUS_EPOCH_START,
            period: PREVIOUS_EPOCH_PERIOD
        });
    }

    function getCurrentEpochStrategy() internal pure returns (EpochStrategy memory) {
        return EpochStrategy({
            offset: CURRENT_EPOCH_OFFSET,
            start: CURRENT_EPOCH_START,
            period: CURRENT_EPOCH_PERIOD
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

    function getBootstrappingSpeedupFactor() internal pure returns (uint256) {
        return BOOTSTRAPPING_SPEEDUP_FACTOR;
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

    function getDAOExitLockupEpochs() internal pure returns (uint256) {
        return DAO_EXIT_LOCKUP_EPOCHS;
    }

    function getPoolExitLockupEpochs() internal pure returns (uint256) {
        return POOL_EXIT_LOCKUP_EPOCHS;
    }

    function getCouponExpiration() internal pure returns (uint256) {
        return COUPON_EXPIRATION;
    }

    function getDebtRatioCap() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: DEBT_RATIO_CAP});
    }

    function getCouponProratedStart() internal pure returns (uint256) {
        return COUPON_PRORATED_START;
    }

    function getSupplyChangeLimit() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: SUPPLY_CHANGE_LIMIT});
    }

    function getCouponSupplyChangeLimit() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: COUPON_SUPPLY_CHANGE_LIMIT});
    }

    function getOraclePoolRatio() internal pure returns (uint256) {
        return ORACLE_POOL_RATIO;
    }

    function getTreasuryRatio() internal pure returns (uint256) {
        return TREASURY_RATIO;
    }

    function getStabilityRewardMin() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: STABILITY_REWARD_MIN});
    }

    function getStabilityRewardRate() internal pure returns (Decimal.D256 memory) {
        return Decimal.D256({value: STABILITY_REWARD_RATE});
    }

    function getChainId() internal pure returns (uint256) {
        return CHAIN_ID;
    }

    function getDaoAddress() internal pure returns (address) {
        return DAO_ADDRESS;
    }

    function getDollarAddress() internal pure returns (address) {
        return DOLLAR_ADDRESS;
    }

    function getPairAddress() internal pure returns (address) {
        return PAIR_ADDRESS;
    }

    function getTreasuryAddress() internal pure returns (address) {
        return TREASURY_ADDRESS;
    }
}
