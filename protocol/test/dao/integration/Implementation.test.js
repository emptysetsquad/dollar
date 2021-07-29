const {
  BN,
  time,
  expectEvent,
  constants,
} = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

// ABIs
const prevImplABI = require("./abi/PrevImpl.json");

// Mainnet Addresses
const DAOAddress = "0x443D2f2755DB5942601fa062Cc248aAA153313D3";
const DollarAddress = "0x36F3FD68E7325a35EB768F1AedaAe9EA0689d723";
const PairAddress = "0x88ff79eB2Bc5850F27315415da8685282C7610F9";
const PoolAddress = "0x4082d11e506e3250009a991061acd2176077c88f";

// Prev Impl Contract
const daoPrevContract = new web3.eth.Contract(prevImplABI, DAOAddress);

// Holder Addresses
const daoVoter1 = "0x0b7376f2a063c771d460210a4fa8787c9a7379f9";
const daoVoter2 = "0xcf61932d5956d0b6f788bd95d76e2ad58416d7d6";
const poolUser1 = "0x4f295d8eabfc0e11d99db02bc02a265d82d7ba76";
const poolUser2 = "0x52A5711Dc4fe437E81205bfaD22fFC43F1818Df7";

// Artifacts
const Dollar = artifacts.require("Dollar");
const Pool = artifacts.require("Pool");
const Implementation = artifacts.require("Implementation");
const ERC20 = artifacts.require("ERC20");
let impl, pool, dollar, dao, commitResult;

contract("Implementation", function ([user]) {
  before(async function () {
    // Attach contracts
    pool = await Pool.at(PoolAddress);
    poolRewarded = await pool.totalRewarded();
    dollar = await Dollar.at(DollarAddress);
    univ2 = await ERC20.at(PairAddress);

    // Deploy new impl
    impl = await Implementation.new();

    // Vote for the impl
    await daoPrevContract.methods
      .vote(impl.address, new BN(1))
      .send({ from: daoVoter1, gas: 200000 });
    await daoPrevContract.methods
      .vote(impl.address, new BN(1))
      .send({ from: daoVoter2, gas: 200000 });

    // Advance
    for (let i = 0; i < 9; i++) {
      await time.increase(86400);
      await daoPrevContract.methods.advance().send({ from: user, gas: 200000 });
    }

    // Commit
    commitResult = await daoPrevContract.methods
      .commit(impl.address)
      .send({ from: user, gas: 1000000 });

    dao = await Implementation.at(DAOAddress);
  });

  describe("initialize", async function () {
    it("initializes successfully", async function () {
      // pauses the pool
      expect(await pool.paused()).to.be.true;

      // snapshots the pool total rewarded
      expect(await dao.poolTotalRewarded()).to.be.bignumber.equal(
        new BN("27737766862508722101253")
      );

      // withdraws all ESD
      expect(await dollar.balanceOf(pool.address)).to.be.bignumber.equal(
        new BN(0)
      );

      // total = startingBalanceOfDAO + poolAmount
      const totalDAODollarBalance = new BN("18054203302612095543187231").add(
        new BN("130026359933984003886242")
      );
      expect(await dollar.balanceOf(dao.address)).to.be.bignumber.equal(
        totalDAODollarBalance
      );

      // withdraws all univ2
      expect(await univ2.balanceOf(pool.address)).to.be.bignumber.equal(
        new BN(0)
      );

      expect(await univ2.balanceOf(dao.address)).to.be.bignumber.equal(
        new BN("16497180939752788")
      );

      expect(await dao.poolDollarWithdrawable()).to.be.bignumber.equal(
        new BN("130026359933984003886242")
      );

      expect(await dao.owner()).to.be.equal(
        "0x1bba92F379375387bf8F927058da14D47464cB7A"
      );
    });
  });

  describe("poolWithdraw", async function () {
    it("withdraws user esd and univ2", async function () {
      const poolDollarWithdrawableBefore = await dao.poolDollarWithdrawable();
      const poolUser1BeforeDollarBalance = await dollar.balanceOf(poolUser1);
      const poolUser1BeforeUniBalance = await univ2.balanceOf(poolUser1);
      const poolUser2BeforeDollarBalance = await dollar.balanceOf(poolUser2);
      const poolUser2BeforeUniBalance = await univ2.balanceOf(poolUser2);

      await dao.poolWithdraw({ from: poolUser1 });
      await dao.poolWithdraw({ from: poolUser2 });

      const poolDollarWithdrawableAfter = await dao.poolDollarWithdrawable();
      const poolUser1AfterDollarBalance = await dollar.balanceOf(poolUser1);
      const poolUser1AfterUniBalance = await univ2.balanceOf(poolUser1);
      const poolUser2AfterDollarBalance = await dollar.balanceOf(poolUser2);
      const poolUser2AfterUniBalance = await univ2.balanceOf(poolUser2);

      expect(
        poolUser1AfterDollarBalance.sub(poolUser1BeforeDollarBalance)
      ).to.be.bignumber.equal(new BN("4"));
      expect(
        poolUser1AfterUniBalance.sub(poolUser1BeforeUniBalance)
      ).to.be.bignumber.equal(new BN("0"));

      expect(
        poolUser2AfterDollarBalance.sub(poolUser2BeforeDollarBalance)
      ).to.be.bignumber.equal(new BN("711563911834085963752"));
      expect(
        poolUser2AfterUniBalance.sub(poolUser2BeforeUniBalance)
      ).to.be.bignumber.equal(new BN("30526731965164"));

      expect(
        poolDollarWithdrawableBefore.sub(poolDollarWithdrawableAfter)
      ).to.be.bignumber.equal(new BN("711563911834085963756"));

      expect(await dao.poolHasWithdrawn(poolUser1)).to.be.true;
      expect(await dao.poolHasWithdrawn(poolUser2)).to.be.true;
    });
  });
});
