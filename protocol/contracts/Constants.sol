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

    /* DAO */
    uint256 private constant ADVANCE_INCENTIVE = 2500e18; // 2500 ESD

    /* Pool */
    uint256 private constant POOL_EXIT_LOCKUP_EPOCHS = 5; // 5 epochs fluid

    /* Deployed */
    address private constant DAO_ADDRESS = address(0x443D2f2755DB5942601fa062Cc248aAA153313D3);
    address private constant DOLLAR_ADDRESS = address(0x36F3FD68E7325a35EB768F1AedaAe9EA0689d723);
    address private constant PAIR_ADDRESS = address(0x88ff79eB2Bc5850F27315415da8685282C7610F9);
    address private constant TREASURY_ADDRESS = address(0x460661bd4A5364A3ABCc9cfc4a8cE7038d05Ea22);
    address private constant POOL_ADDRESS = address(0x4082D11E506e3250009A991061ACd2176077C88f);
    address private constant ORACLE_ADDRESS = address(0xea9f8bb8B5e8BA3D38628f0E18Ee82300eddBa0E);
    address private constant V2_MIGRATOR_ADDRESS = address(0xC61D12896421613b30D56F85c093CdDa43Ab2CE7);
    address private constant V2_DAO_ADDRESS = address(0x1bba92F379375387bf8F927058da14D47464cB7A);
    address private constant V2_ESS_ADDRESS = address(0x24aE124c4CC33D6791F8E8B63520ed7107ac8b3e);

    /**
     * Getters
     */

    function getUsdcAddress() internal pure returns (address) {
        return USDC;
    }

    function getOracleReserveMinimum() internal pure returns (uint256) {
        return ORACLE_RESERVE_MINIMUM;
    }

    function getInitialStakeMultiple() internal pure returns (uint256) {
        return INITIAL_STAKE_MULTIPLE;
    }

    function getAdvanceIncentive() internal pure returns (uint256) {
        return ADVANCE_INCENTIVE;
    }

    function getPoolExitLockupEpochs() internal pure returns (uint256) {
        return POOL_EXIT_LOCKUP_EPOCHS;
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

    function getPoolAddress() internal pure returns (address) {
        return POOL_ADDRESS;
    }

    function getOracleAddress() internal pure returns (address) {
        return ORACLE_ADDRESS;
    }

    function getV2MigratorAddress() internal pure returns (address) {
        return V2_MIGRATOR_ADDRESS;
    }

    function getV2DaoAddress() internal pure returns (address) {
        return V2_DAO_ADDRESS;
    }

    function getV2EssAddress() internal pure returns (address) {
        return V2_ESS_ADDRESS;
    }
}

interface IV2Migrator {
    function migrate(uint256 dollarAmount, uint256 stakeAmount) external;
}
