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
import '@uniswap/v2-core/contracts/interfaces/IUniswapV2Pair.sol';
import '../external/UniswapV2Library.sol';
import "../Constants.sol";
import "./PoolGetters.sol";

contract Liquidity is PoolGetters {
    address private constant UNISWAP_FACTORY = address(0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f);

    function addLiquidity(uint256 dollarAmount) internal returns (uint256, uint256) {
        (address dollar, address usdc) = (address(dollar()), usdc());
        (uint reserveA, uint reserveB) = getReserves(dollar, usdc);

        uint256 usdcAmount = (reserveA == 0 && reserveB == 0) ?
             dollarAmount :
             UniswapV2Library.quote(dollarAmount, reserveA, reserveB);

        address pair = address(univ2());
        IERC20(dollar).transfer(pair, dollarAmount);
        IERC20(usdc).transferFrom(msg.sender, pair, usdcAmount);
        return (usdcAmount, IUniswapV2Pair(pair).mint(address(this)));
    }

    // overridable for testing
    function getReserves(address tokenA, address tokenB) internal view returns (uint reserveA, uint reserveB) {
        (address token0,) = UniswapV2Library.sortTokens(tokenA, tokenB);
        (uint reserve0, uint reserve1,) = IUniswapV2Pair(UniswapV2Library.pairFor(UNISWAP_FACTORY, tokenA, tokenB)).getReserves();
        (reserveA, reserveB) = tokenA == token0 ? (reserve0, reserve1) : (reserve1, reserve0);
    }
}
