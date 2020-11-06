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

pragma solidity 0.5.17;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "./State.sol";
import "../Constants.sol";

/// @author Empty Set Squad
/// @title Getters surfacing state for døllar's DAO
contract Getters is State {
    using SafeMath for uint256;
    using Decimal for Decimal.D256;

    bytes32 private constant IMPLEMENTATION_SLOT = 0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc;

    /**
     * ERC20 Interface
     */

    /// @dev Returns the name of DAO token.
    function name() public view returns (string memory) {
        return "Empty Set Dollar Stake";
    }

    /// @dev Returns the symbol of DAO token.
    function symbol() public view returns (string memory) {
        return "ESDS";
    }

    /// @dev Returns the decimals of DAO token.
    function decimals() public view returns (uint8) {
        return 18;
    }

    /// @dev Returns the DAO token balance of `account`.
    /// @param account The account.
    /// @return The balance of `account.
    function balanceOf(address account) public view returns (uint256) {
        return _state.accounts[account].balance;
    }

    /// @dev Returns the total supply of DAO tokens.
    function totalSupply() public view returns (uint256) {
        return _state.balance.supply;
    }

    /// @dev Placeholder to conform to ERC20. ESDS cannot currently be approved or transferred.
    /// @param owner The owner of the tokens.
    /// @param spender The spender of the tokens.
    /// @return The approval amount.
    function allowance(address owner, address spender) external view returns (uint256) {
        return 0;
    }

    /**
     * Global
     */

    /// @dev Returns the address of the ESD token.
    function dollar() public view returns (IDollar) {
        return _state.provider.dollar;
    }

    /// @dev Returns the address of the Oracle contract.
    function oracle() public view returns (IOracle) {
        return _state.provider.oracle;
    }

    /// @dev Returns the address of the LP incentivization contract.
    function pool() public view returns (address) {
        return _state.provider.pool;
    }

    /// @dev Returns the address of the treasury.
    function treasury() public view returns (address) {
        return Constants.getTreasuryAddress();
    }

    /// @dev Returns the total amount of ESD currently bonded.
    function totalBonded() public view returns (uint256) {
        return _state.balance.bonded;
    }

    /// @dev Returns the total amount of ESD currently deposited, but not bonded.
    function totalStaged() public view returns (uint256) {
        return _state.balance.staged;
    }

    /// @dev Returns the total amount of ESD debt.
    function totalDebt() public view returns (uint256) {
        return _state.balance.debt;
    }

    /// @dev Returns the total amount of ESD currently in the redeemable pool.
    function totalRedeemable() public view returns (uint256) {
        return _state.balance.redeemable;
    }

    /// @dev Returns the total amount of coupons that are currently outstanding.
    function totalCoupons() public view returns (uint256) {
        return _state.balance.coupons;
    }

    /// @dev Returns the total amount of ESDS locked from opt-in vesting.
    function totalUnvested() public view returns (uint256) {
        uint256 epoch = epoch();
        if (epoch > Constants.getVestingPeriod()) {
            return 0;
        }

        return _state1.totalVesting
            .mul(Constants.getVestingPeriod().sub(epoch).add(1))
            .div(Constants.getVestingPeriod());
    }

    /// @dev Returns the total amount of ESD locked from opt-in vesting.
    function totalUnvestedUnderlying() public view returns (uint256) {
        return totalSupply() == 0 ?
            0 :
            totalUnvested().mul(totalBonded()).div(totalSupply());
    }

    /// @dev Returns the total supply of ESD less debt and unvested.
    function totalNet() public view returns (uint256) {
        uint256 totalSupply = dollar().totalSupply();
        uint256 totalDebt = totalDebt();
        uint256 totalUnvestedUnderlying = totalUnvestedUnderlying();

        if (totalDebt > totalSupply) {
            return 0;
        }
        totalSupply = totalSupply.sub(totalDebt);

        if (totalUnvestedUnderlying > totalSupply) {
            return 0;
        }
        return totalSupply.sub(totalUnvestedUnderlying);
    }

    /**
     * Account
     */

    /// @dev Returns the ESD balance of `account` that is deposited, but not bonded.
    /// @param account The account.
    /// @return The staged balance of `account`.
    function balanceOfStaged(address account) public view returns (uint256) {
        return _state.accounts[account].staged;
    }

    /// @dev Returns the ESD balance of `account` that is bonded.
    /// @param account The account.
    /// @return The bonded balance of `account`.
    function balanceOfBonded(address account) public view returns (uint256) {
        uint256 totalSupply = totalSupply();
        if (totalSupply == 0) {
            return 0;
        }
        return totalBonded().mul(balanceOf(account)).div(totalSupply);
    }

    /// @dev Returns the coupon balance of `account` for a specific epoch of coupons.
    /// @param account The account.
    /// @param epoch The epoch tranche of coupons.
    /// @return The coupon balance of `account` for `epoch`.
    function balanceOfCoupons(address account, uint256 epoch) public view returns (uint256) {
        if (outstandingCoupons(epoch) == 0) {
            return 0;
        }
        return _state.accounts[account].coupons[epoch];
    }

    /// @dev Returns the bonding status of `account`.
    ///      0=Frozen, 1=Fluid, 2=Locked
    /// @param account The account.
    /// @return The status of `account`.
    function statusOf(address account) public view returns (Account.Status) {
        if (_state.accounts[account].lockedUntil > epoch()) {
            return Account.Status.Locked;
        }

        return epoch() >= _state.accounts[account].fluidUntil ? Account.Status.Frozen : Account.Status.Fluid;
    }

    /// @dev Returns the amount of coupons `spender` is allowed to to spend form `account`.
    /// @param owner The account that owns the coupons.
    /// @param spender The account that will spend the coupons.
    /// @return The allowance.
    function allowanceCoupons(address owner, address spender) public view returns (uint256) {
        return _state.accounts[owner].couponAllowances[spender];
    }

    /// @dev Returns whether vesting has been enable for `account`.
    /// @param account The account.
    /// @return whether vesting has been set up.
    function hasVesting(address account) public view returns (bool) {
        return _state1.vesting[account] != 0;
    }

    /// @dev Returns the amount of unvested ESDS for `account`.=
    /// @param account The account.
    /// @return the unvested balance.
    function balanceOfUnvested(address account) public view returns (uint256) {
        uint256 epoch = epoch();
        if (epoch > Constants.getVestingPeriod()) {
            return 0;
        }

        if (!hasVesting(account)) {
            return 0;
        }

        return _state1.vesting[account]
            .mul(Constants.getVestingPeriod().sub(epoch).add(1))
            .div(Constants.getVestingPeriod());
    }

    /**
     * Epoch
     */

    /// @dev Returns the current state-based epoch.
    function epoch() public view returns (uint256) {
        return _state.epoch.current;
    }

    /// @dev Returns the current time-based epoch.
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

    /// @dev Returns the amount of outstanding coupons for `epoch`.
    /// @param epoch The epoch.
    /// @return The amount of coupons.
    function outstandingCoupons(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].coupons.outstanding;
    }

    /// @dev Returns the expiration epoch for the `epoch`.
    /// @param epoch The epoch.
    /// @return The expiration epoch.
    function couponsExpiration(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].coupons.expiration;
    }

    /// @dev Returns the length of the array of epochs that expire during `epoch`.
    /// @param epoch The epoch.
    /// @return The count of coupon epochs.
    function expiringCoupons(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].coupons.expiring.length;
    }

    /// @dev Returns the epoch that expire during `epoch` at index `i`.
    /// @param epoch The epoch.
    /// @param i The index.
    /// @return The epoch that is expiring.
    function expiringCouponsAtIndex(uint256 epoch, uint256 i) public view returns (uint256) {
        return _state.epochs[epoch].coupons.expiring[i];
    }

    /// @dev Returns the historical sample of total supply of ESDS at end of `epoch`.
    /// @param epoch The epoch.
    /// @return The ESDS supply.
    function totalBondedAt(uint256 epoch) public view returns (uint256) {
        return _state.epochs[epoch].bonded;
    }

    /**
     * Governance
     */

    /// @dev Returns the recorded vote from `account` for the `candidate` implementation contract.
    /// @param account The account.
    /// @param candidate The candidate implementation.
    /// @return The recorded vote.
    function recordedVote(address account, address candidate) public view returns (Candidate.Vote) {
        return _state.candidates[candidate].votes[account];
    }

    /// @dev Returns the start epoch for the `candidate` election.
    /// @param candidate The candidate implementation.
    /// @return The start epoch.
    function startFor(address candidate) public view returns (uint256) {
        return _state.candidates[candidate].start;
    }

    /// @dev Returns the epoch period for the `candidate` election.
    /// @param candidate The candidate implementation.
    /// @return The epoch period.
    function periodFor(address candidate) public view returns (uint256) {
        return _state.candidates[candidate].period;
    }

    /// @dev Returns the recorded ESDS votes approving `candidate`.
    /// @param candidate The candidate implementation.
    /// @return The approve votes for.
    function approveFor(address candidate) public view returns (uint256) {
        return _state.candidates[candidate].approve;
    }

    /// @dev Returns the recorded ESDS votes rejecting `candidate`.
    /// @param candidate The candidate implementation.
    /// @return The reject votes for.
    function rejectFor(address candidate) public view returns (uint256) {
        return _state.candidates[candidate].reject;
    }

    /// @dev Returns the total recorded ESDS votes for `candidate`.
    /// @param candidate The candidate implementation.
    /// @return The total votes for.
    function votesFor(address candidate) public view returns (uint256) {
        return approveFor(candidate).add(rejectFor(candidate));
    }

    /// @dev Returns whether the `candidate` implementation has already been nominated.
    /// @param candidate The candidate implementation.
    /// @return Whether `candidate` is nominated.
    function isNominated(address candidate) public view returns (bool) {
        return _state.candidates[candidate].start != 0;
    }

    /// @dev Returns whether the `candidate` implementation has been committed and initialized.
    /// @param candidate The candidate implementation.
    /// @return Whether `candidate` is been initialized.
    function isInitialized(address candidate) public view returns (bool) {
        return _state.candidates[candidate].initialized;
    }

    /// @dev Returns the current implementation contract.
    function implementation() public view returns (address impl) {
        bytes32 slot = IMPLEMENTATION_SLOT;
        assembly {
            impl := sload(slot)
        }
    }
}
