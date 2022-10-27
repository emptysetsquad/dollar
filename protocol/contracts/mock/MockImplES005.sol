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

import "../dao/Implementation.sol";
import "../token/Dollar.sol";
import "./MockState.sol";

contract MockImplES005 is MockState, Implementation {
    address private _dollar;
    address private _ess;
    address private _migrator;

    constructor(address ess) public {
        _dollar = address(new Dollar());
        _ess = ess;
    }

    /* For testing only */
    function mintToE(address account, uint256 amount) external {
        dollar().mint(account, amount);
    }

    function burnFromE(address account, uint256 amount) external {
        dollar().burnFrom(account, amount);
    }

    function dollar() public view returns (IDollar) {
        return IDollar(_dollar);
    }

    function ess() public view returns (IERC20) {
        return IERC20(_ess);
    }

    function setV2MigratorE(address newMigrator) external {
        _migrator = newMigrator;
    }

    function v2Migrator() public view returns (address) {
        return _migrator;
    }

    function setOwnerE(address newOwner) public {
        super.setOwner(newOwner);
    }
}
