pragma solidity ^0.5.17;

import "../Constants.sol";
import "../external/Decimal.sol";
import "./Setters.sol";
import "./Comptroller.sol";

contract Stabilizer is Setters, Comptroller {
    event StabilityReward(uint256 indexed epoch, uint256 rate, uint256 amount);

    function step() internal {
        // NoOp
    }
}
