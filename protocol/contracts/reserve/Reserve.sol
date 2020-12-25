pragma solidity ^0.5.17;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";

import "../Interfaces.sol";
import "./ReserveComptroller.sol";

contract Reserve is IReserve, ReserveComptroller, ReentrancyGuard {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event OrderRegistered(address indexed makerToken, address indexed takerToken, uint256 price, uint256 amount);
    event Swap(address indexed makerToken, address indexed takerToken, uint256 takerAmount, uint256 makerAmount);

    struct Order {
        uint256 price;
        uint256 amount;
    }

    mapping(address => mapping(address => Order)) _orders;

    function registerOrder(address makerToken, address takerToken, uint256 price, uint256 amount) external onlyDao {
        _orders[makerToken][takerToken] = Order({
            price: price,
            amount: amount
        });

        emit OrderRegistered(makerToken, takerToken, price, amount);
    }

    function order(address makerToken, address takerToken) external view returns (uint256, uint256) {
        Order memory o = _orders[makerToken][takerToken];
        return (o.price, o.amount);
    }

    // TODO: test
    function swap(address makerToken, address takerToken, uint256 takerAmount) external nonReentrant {
        require(makerToken != takerToken, "Reserve: tokens equal");

        IERC20(takerToken).safeTransferFrom(msg.sender, address(this), takerAmount);

        if (takerToken == dollar()) {
            burnWithCap(takerAmount);
        }

        Order storage order = _orders[makerToken][takerToken];

        uint256 orderPrice = order.price;
        require(orderPrice > 0, "Reserve: no order");
        uint256 makerAmount = takerAmount.mul(BASE).div(orderPrice);

        if (makerToken == dollar()) {
            mintWithCap(makerAmount);
        }

        if (order.amount != uint256(-1)) {
            order.amount = order.amount.sub(makerAmount, "Reserve: amount too large");
        }
        IERC20(makerToken).safeTransfer(msg.sender, makerAmount);

        emit Swap(makerToken, takerToken, takerAmount, makerAmount);
    }
}
