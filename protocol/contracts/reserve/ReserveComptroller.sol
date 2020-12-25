pragma solidity ^0.5.17;

import "@openzeppelin/contracts/math/SafeMath.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/SafeERC20.sol";

import "../Constants.sol";
import "../dao/State.sol";
import "../Interfaces.sol";

contract ReserveComptroller {
    using SafeMath for uint256;
    using SafeERC20 for IERC20;

    event MintRateCapUpdate(uint256 newMintRateCap);
    event BurnRateCapUpdate(uint256 newBurnRateCap);

    uint256 internal constant BASE = 1e18;
    uint256 private constant RATE_CAP = 3e16;

    struct Emissions {
        uint256 mintRateCap;
        uint256 burnRateCap;
        mapping(uint256 => EmissionEpoch) epochs;
    }

    struct EmissionEpoch {
        uint256 supply;
        uint256 minted;
        uint256 burned;
    }

    Emissions private _emissions;

    // EXTERNAL

    function mintRateCap() external view returns (uint256) {
        return _emissions.mintRateCap;
    }

    function burnRateCap() external view returns (uint256) {
        return _emissions.burnRateCap;
    }

    function setMintRateCap(uint256 newMintRateCap) external onlyDao {
        require(newMintRateCap <= RATE_CAP, "ReserveComptroller: rate too high");
        _emissions.mintRateCap = newMintRateCap;
        emit MintRateCapUpdate(newMintRateCap);
    }

    function setBurnRateCap(uint256 newBurnRateCap) external onlyDao {
        require(newBurnRateCap <= RATE_CAP, "ReserveComptroller: rate too high");
        _emissions.burnRateCap = newBurnRateCap;
        emit BurnRateCapUpdate(newBurnRateCap);
    }

    function mintable(uint256 epoch) public view returns (uint256) {
        uint256 totalMintable = totalSupplyAt(epoch).mul(_emissions.mintRateCap).div(BASE);
        uint256 alreadyMinted = _emissions.epochs[epoch].minted;
        return totalMintable > alreadyMinted ? totalMintable.sub(alreadyMinted) : 0;
    }

    function burnable(uint256 epoch) public view returns (uint256) {
        uint256 totalBurnable = totalSupplyAt(epoch).mul(_emissions.burnRateCap).div(BASE);
        uint256 alreadyBurned = _emissions.epochs[epoch].burned;
        return totalBurnable > alreadyBurned ? totalBurnable.sub(alreadyBurned) : 0;
    }

    function withdraw(address token, uint256 amount) external onlyDao {
        IERC20(token).safeTransfer(dao(), amount);
    }

    // INTERNAL

    function mintWithCap(uint256 mintAmount) internal {
        uint256 epoch = recordTotalSupply();
        require(mintAmount <= mintable(epoch), "ReserveComptroller: not enough mintable");
        _emissions.epochs[epoch].minted = _emissions.epochs[epoch].minted.add(mintAmount);
        IDAO(dao()).mintToReserve(mintAmount);
    }

    function burnWithCap(uint256 burnAmount) internal {
        uint256 epoch = recordTotalSupply();
        require(burnAmount <= burnable(epoch), "ReserveComptroller: not enough burnable");
        _emissions.epochs[epoch].burned = _emissions.epochs[epoch].burned.add(burnAmount);
        IDollar(dollar()).burn(burnAmount);
    }

    function totalSupplyAt(uint256 epoch) public view returns (uint256) {
        return _emissions.epochs[epoch].supply;
    }

    function recordTotalSupply() internal returns (uint256) {
        // Get epoch
        uint256 epoch = IDAO(dao()).epoch();

        // Stamp epoch supply
        if (totalSupplyAt(epoch) == 0) {
            _emissions.epochs[epoch].supply = IERC20(dollar()).totalSupply();
        }

        return epoch;
    }

    // TESTING

    function dao() internal returns (address) {
        return Constants.getDaoAddress();
    }

    function dollar() internal returns (address) {
        return Constants.getDollarAddress();
    }

    // PERMISSIONS

    modifier onlyDao {
        require(msg.sender == dao(), "ReserveComptroller: not dao");

        _;
    }
}