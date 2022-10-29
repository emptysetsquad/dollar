pragma solidity ^0.5.17;
pragma experimental ABIEncoderV2;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "../token/IDollar.sol";

contract MockIDAO {
    function totalSupply() external view returns (uint256);
    function totalCouponUnderlying() external view returns (uint256);
    function burn(address account, uint256 stakeAmount) external;
}

contract MockV2Migrator {
    using SafeMath for uint256;

    uint256 public ratio;
    MockIDAO public dao;
    address public dollar;
    address public stake;
    address public reserve;

    constructor(uint256 ratio_, MockIDAO dao_, address dollar_, address stake_, address reserve_) public {
        ratio = ratio_;
        dao = dao_;
        dollar = dollar_;
        stake = stake_;
        reserve = reserve_;
    }

    function initialize() external {
        _verifyBalance();
    }

    function outstandingStake() public view returns (uint256) {
        uint256 bondedStake = dao.totalSupply();
        uint256 circulatingDollar = IDollar(dollar).totalSupply();
        uint256 circulatingCouponUnderlying = dao.totalCouponUnderlying();
        uint256 circulatingStake = ratio.mul(circulatingDollar.add(circulatingCouponUnderlying)).div(10**18);

        return bondedStake.add(circulatingStake);
    }

    /**
     * @notice Allows the owner to withdraw `amount` ESDS to the reserve
     * @dev Owner only - governance hook
     *      Verifies that this contract is sufficiently funded - reverts if not
     */
    function withdraw(uint256 amount) external {
        IERC20(stake).transfer(reserve, amount);
        _verifyBalance();
    }

    /**
     * @notice Check that this contract is sufficiently funded with Continuous ESDS for the remaining
     *         {outstandingStake}
     * @dev Internal only - helper
     *      Verifies that this contract is sufficiently funded - reverts if not
     */
    function _verifyBalance() private view {
        require(IERC20(stake).balanceOf(address(this)) >= outstandingStake(), "Migrator: insufficient funds");
    }

    // MIGRATE

    /**
     * @notice Migrates `dollarAmount` v1 ESD and `stakeAmount` v1 ESDS for the caller to Continuous ESDS
     * @dev Contract must be initialized to call
     * @param dollarAmount Amount of v1 ESD to migrate
     * @param stakeAmount Amount of v1 ESDS to migrate
     */
    function migrate(uint256 dollarAmount, uint256 stakeAmount) external {
        _migrateDollar(msg.sender, dollarAmount);
        _migrateStake(msg.sender, stakeAmount);
    }

    /**
     * @notice Migrates `dollarAmount` v1 ESD for `account` to Continuous ESDS
     * @dev Internal only - helper
     * @param account Account to migrate funds for
     * @param dollarAmount Amount of v1 ESD to migrate
     */
    function _migrateDollar(address account, uint256 dollarAmount) private {
        IDollar(dollar).transferFrom(account, address(this), dollarAmount);
        IDollar(dollar).burn(dollarAmount);
        IERC20(stake).transfer(account, ratio.mul(dollarAmount).div(10**18));
    }

    /**
     * @notice Migrates `stakeAmount` v1 ESDS for `account` to Continuous ESDS
     * @dev Internal only - helper
     * @param account Account to migrate funds for
     * @param stakeAmount Amount of v1 ESDS to migrate
     */
    function _migrateStake(address account, uint256 stakeAmount) private {
        dao.burn(account, stakeAmount);
        IERC20(stake).transfer(account, stakeAmount);
    }
}
