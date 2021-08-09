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

contract IPool {
    /*
     * Emergency Functions
     */
    function emergencyWithdraw(address token, uint256 value) external;
    function emergencyPause() external;

    /*
     * Getters
     */
    function totalBonded() public view returns (uint256);
    function totalStaged() public view returns (uint256);
    function totalClaimable() public view returns (uint256);
    function totalRewarded() public view returns (uint256);
    function totalPhantom() public view returns (uint256);
    function univ2() public view returns (IERC20);

    /**
     * Account
     */
    function balanceOfStaged(address account) public view returns (uint256);
    function balanceOfClaimable(address account) public view returns (uint256);
    function balanceOfBonded(address account) public view returns (uint256);
    function balanceOfPhantom(address account) public view returns (uint256);
    function balanceOfRewarded(address account) public view returns (uint256);
}
