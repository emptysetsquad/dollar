pragma solidity ^0.5.17;

import "../Constants.sol";
import "../external/Decimal.sol";
import "./Setters.sol";
import "./Comptroller.sol";

contract Stabilizer is Setters, Comptroller {
    event StabilityReward(uint256 indexed epoch, uint256 rate, uint256 amount);

    function step() internal {
        Decimal.D256 memory debtRatio = Decimal.ratio(totalDebt(), dollar().totalSupply());
        debtRatio = debtRatio.greaterThan(Constants.getDebtRatioCap()) ? Constants.getDebtRatioCap() : debtRatio;

        Decimal.D256 memory epochRate = Constants.getStabilityRewardMin().add(debtRatio.mul(Constants.getStabilityRewardRate()));
        uint256 reward = epochRate.mul(totalBonded()).asUint256();
        uint256 rewarded = stabilityReward(reward);

        emit StabilityReward(epoch(), epochRate.value, rewarded);
    }
}
