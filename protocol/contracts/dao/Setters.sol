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
import "./Getters.sol";

contract Setters is State, Getters {
    using SafeMath for uint256;

    event Transfer(address indexed from, address indexed to, uint256 value);

    /**
     * ERC20 Interface
     */

    function transfer(address recipient, uint256 amount) external returns (bool) {
        return false;
    }

    function approve(address spender, uint256 amount) external returns (bool) {
        return false;
    }

    function transferFrom(address sender, address recipient, uint256 amount) external returns (bool) {
        return false;
    }

    /**
     * Account
     */
    function decrementBalanceOf(address account, uint256 amount, string memory reason) internal {
        _state.accounts[account].balance = _state.accounts[account].balance.sub(amount, reason);
        _state.balance.supply = _state.balance.supply.sub(amount, reason);

        emit Transfer(account, address(0), amount);
    }

    function incrementBalanceOf(address account, uint256 amount) internal {
        _state.accounts[account].balance = _state.accounts[account].balance.add(amount);
        _state.balance.supply = _state.balance.supply.add(amount);

        emit Transfer(address(0), account, amount);
    }

    function decrementBalanceOfStaged(address account, uint256 amount, string memory reason) internal {
        _state.accounts[account].staged = _state.accounts[account].staged.sub(amount, reason);
        _state.balance.staged = _state.balance.staged.sub(amount, reason);
    }

    function incrementBalanceOfCouponUnderlying(address account, uint256 epoch, uint256 amount) internal {
        _state16.couponUnderlyingByAccount[account][epoch] = _state16.couponUnderlyingByAccount[account][epoch].add(amount);
        _state16.couponUnderlying = _state16.couponUnderlying.add(amount);
    }

    function decrementBalanceOfCouponUnderlying(address account, uint256 epoch, uint256 amount, string memory reason) internal {
        _state16.couponUnderlyingByAccount[account][epoch] = _state16.couponUnderlyingByAccount[account][epoch].sub(amount, reason);
        _state16.couponUnderlying = _state16.couponUnderlying.sub(amount, reason);
    }

    function updateAllowanceCoupons(address owner, address spender, uint256 amount) internal {
        _state.accounts[owner].couponAllowances[spender] = amount;
    }

    function decrementAllowanceCoupons(address owner, address spender, uint256 amount, string memory reason) internal {
        _state.accounts[owner].couponAllowances[spender] =
            _state.accounts[owner].couponAllowances[spender].sub(amount, reason);
    }

    /**
     * Governance
     */
    function initialized(address candidate) internal {
        _state.candidates[candidate].initialized = true;
    }

    /**
     * Pool Migration - EIP25
     */
    function snapshotPoolTotalRewarded(uint256 totalRewarded) internal {
        _state25.poolTotalRewarded = totalRewarded;
    }

    function snapshotPoolTotalDollar(uint256 total) internal {
        _state25.poolDollarWithdrawable = total;
    }

    function decrementPoolDollarWithdrawable(uint256 amount, string memory reason) internal {
        _state25.poolDollarWithdrawable = _state25.poolDollarWithdrawable.sub(amount, reason);
    }

    function poolMarkWithdrawn(address account) internal {
        _state25.poolWithdrawn[account] = true;
    }

    function setOwner(address newOwner) internal {
        _state25.owner = newOwner;
    }
}
