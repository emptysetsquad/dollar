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

import "../dao/Govern.sol";
import "./MockUpgradeable.sol";
import "./MockComptroller.sol";

contract MockGovern is Govern, MockComptroller {
    uint256 internal _epochTime;

    constructor() MockComptroller(address(0)) public { }

    function initialize() public {
        revert("Should not call");
    }

    function upgradeToE(address newImplementation) external {
        super.upgradeTo(newImplementation);
    }

    function setEpochTime(uint256 epochTime) external {
        _epochTime = epochTime;
    }

    function epochTime() public view returns (uint256) {
        return _epochTime;
    }
}
