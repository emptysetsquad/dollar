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
import "./IUniswapV2Router02.sol";
import "../oracle/IDAO.sol";
import "../Constants.sol";

contract Forwarder {
    IUniswapV2Router02 public router;
    IDAO public dao;
    IERC20 public usdc;
    IERC20 public dollar;

    constructor() public {
        router = IUniswapV2Router02(0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D);
        dao = IDAO(Constants.getDaoAddress());
        usdc = IERC20(Constants.getUsdcAddress());
        dollar = IERC20(Constants.getDollarAddress());

        usdc.approve(address(router), uint256(-1));
    }

    function buildPath() private view returns (address[] memory) {
        address[] memory path = new address[](2);
        path[0] = address(usdc);
        path[1] = address(dollar);
        return path;
    }

    function purchaseCoupons(uint256 usdcAmount, uint256 couponAmountMin, uint256 deadline) external returns (uint256) {
        require(usdc.transferFrom(msg.sender, address(this), usdcAmount), "Forwarder: usdc transfer failed");
        uint256[] memory amounts = router.swapExactTokensForTokens(usdcAmount, 0, buildPath(), address(this), deadline);
        uint256 couponAmount = dao.purchaseCoupons(amounts[1]);
        require(couponAmount >= couponAmountMin, "Forwarder: not enough coupons");
        dao.transferCoupons(address(this), msg.sender, dao.epoch(), couponAmount);
        return couponAmount;
    }
}
