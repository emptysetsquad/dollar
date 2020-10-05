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

import "../dao/Comptroller.sol";
import "../token/Dollar.sol";
import "./MockState.sol";

contract MockComptroller is Comptroller, MockState {
    constructor(address pool) public {
        _state.provider.dollar = new Dollar();
        _state.provider.pool = pool;
    }

    function mintToAccountE(address account, uint256 amount) external {
        super.mintToAccount(account, amount);
    }

    function burnFromAccountE(address account, uint256 amount) external {
        super.burnFromAccount(account, amount);
    }

    function redeemToAccountE(address account, uint256 amount) external {
        super.redeemToAccount(account, amount);
    }

    function burnRedeemableE(uint256 amount) external {
        super.burnRedeemable(amount);
    }

    function increaseDebtE(uint256 amount) external {
        super.increaseDebt(amount);
    }

    function decreaseDebtE(uint256 amount) external {
        super.decreaseDebt(amount);
    }

    function resetDebtE(uint256 percent) external {
        super.resetDebt(Decimal.ratio(percent, 100));
    }

    /* For testing only */
    function mintToE(address account, uint256 amount) external {
        dollar().mint(account, amount);
    }
}
