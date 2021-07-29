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
import "./interfaces/IPool.sol";
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
        return IDollar(Constants.getDollarAddress());
    }

    function oracle() public view returns (IOracle) {
        return IOracle(Constants.getOracleAddress());
    }

    function pool() public view returns (IPool) {
        return IPool(Constants.getPoolAddress());
    }

    function univ2() public view returns (IERC20) {
        return IERC20(Constants.getPairAddress());
    }

    function v2Migrator() public view returns (address) {
        return Constants.getV2MigratorAddress();
    }

    function owner() public view returns (address) {
        return _state25.owner;
    }

    function totalBonded() public view returns (uint256) {
        return _state.balance.bonded;
    }

    function totalStaged() public view returns (uint256) {
        return _state.balance.staged;
    }

    function totalCouponUnderlying() public view returns (uint256) {
        return _state16.couponUnderlying;
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

    function balanceOfCouponUnderlying(address account, uint256 epoch) public view returns (uint256) {
        return _state16.couponUnderlyingByAccount[account][epoch];
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
        return epoch();
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

    /**
     * Pool Migration
     */
    function poolTotalRewarded() public view returns (uint256) {
        return _state25.poolTotalRewarded;
    }

    function poolHasWithdrawn(address account) public view returns (bool) {
        return _state25.poolWithdrawn[account];
    }

    function poolWithdrawable(address account) public view returns (uint256, uint256) {
        if (poolHasWithdrawn(account)) {
            return (0, 0);
        }

        uint256 univ2Amount = pool().balanceOfBonded(account).add(pool().balanceOfStaged(account));
        uint256 dollarAmount = pool().balanceOfClaimable(account).add(poolBalanceOfRewarded(account));

        return (univ2Amount, dollarAmount);
    }

    function poolBalanceOfRewarded(address account) internal view returns (uint256) {
        uint256 totalBonded = pool().totalBonded();
        if (totalBonded == 0) {
            return 0;
        }

        uint256 totalRewardedWithPhantom = poolTotalRewarded().add(pool().totalPhantom());
        uint256 balanceOfRewardedWithPhantom = totalRewardedWithPhantom
            .mul(pool().balanceOfBonded(account))
            .div(totalBonded);

        uint256 balanceOfPhantom = pool().balanceOfPhantom(account);
        if (balanceOfRewardedWithPhantom > balanceOfPhantom) {
            return balanceOfRewardedWithPhantom.sub(balanceOfPhantom);
        }
        return 0;
    }

    function poolDollarWithdrawable() public view returns (uint256) {
        return _state25.poolDollarWithdrawable;
    }

    /*
     * DEPRECATED
     */
    function totalCoupons() public view returns (uint256) {
        return 0;
    }

    function balanceOfCoupons(address account, uint256 epoch) public view returns (uint256) {
        return 0;
    }

    function outstandingCoupons(uint256 epoch) public view returns (uint256) {
        return 0;
    }

    function bootstrappingAt(uint256 epoch) public view returns (bool) {
        return false;
    }

    function eraStatus() public view returns (Era.Status) {
        return Era.Status.CONTRACTION;
    }

    function eraStart() public view returns (uint256) {
        return 0;
    }

    function couponPremium(uint256 amount) public view returns (uint256) {
        return 0;
    }

    function totalDebt() public view returns (uint256) {
        return 0;
    }

    function totalRedeemable() public view returns (uint256) {
        return 0;
    }
}
