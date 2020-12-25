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

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "./external/Decimal.sol";

contract IUSDC {
    function isBlacklisted(address _account) external view returns (bool);
}

contract IOracle {
    function setup() public;
    function capture() public returns (Decimal.D256 memory, bool);
    function pair() external view returns (address);
}

contract IDAO {
    function epoch() external view returns (uint256);
    function mintToReserve(uint256 amount) external;
}

contract IDollar is IERC20 {
    function burn(uint256 amount) public;
    function burnFrom(address account, uint256 amount) public;
    function mint(address account, uint256 amount) public returns (bool);
}

contract IReserve {
    function setMintRateCap(uint256 newMintRateCap) external;
    function setBurnRateCap(uint256 newBurnRateCap) external;
    function registerOrder(address makerToken, address takerToken, uint256 price, uint256 amount) external;
}