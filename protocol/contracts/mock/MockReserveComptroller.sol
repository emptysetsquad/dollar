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

import "../reserve/ReserveComptroller.sol";

contract MockReserveComptroller is ReserveComptroller {
    address private _dao;
    address private _dollar;

    uint256 private _lastEpochResult;

    constructor(address dao, address dollar) public {
        _dao = dao;
        _dollar = dollar;
    }

    function dao() internal returns (address) {
        return _dao;
    }

    function dollar() internal returns (address) {
        return _dollar;
    }

    function mintWithCapE(uint256 mintAmount) external {
        super.mintWithCap(mintAmount);
    }

    function burnWithCapE(uint256 burnAmount) external {
        super.burnWithCap(burnAmount);
    }

    function recordTotalSupplyE() external {
        _lastEpochResult = super.recordTotalSupply();
    }

    function getLastEpochResult() external view returns (uint256) {
        return _lastEpochResult;
    }
}
