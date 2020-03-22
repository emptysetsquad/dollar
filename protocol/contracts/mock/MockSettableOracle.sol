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

import "../external/Decimal.sol";
import "../oracle/IOracle.sol";

contract MockSettableOracle is IOracle {
    Decimal.D256 internal _price;
    bool internal _valid;
    uint256 internal _lastReserve;
    uint256 internal _reserve;

    function set(uint256 numerator, uint256 denominator, bool valid) external {
        _price = Decimal.ratio(numerator, denominator);
        _valid = valid;
    }

    function setup() public { }

    function capture() public returns (Decimal.D256 memory, bool) {
        return (_price, _valid);
    }

    function pair() external view returns (address) { revert("Should not use"); }
}
