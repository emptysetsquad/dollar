const {
  BN,
  time,
  expectEvent,
  constants,
} = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

// ABIs
const prevImplABI = require("./abi/PrevImpl.json");
const {accounts} = require("@openzeppelin/test-environment");

// Mainnet Addresses
const DAOAddress = "0x443D2f2755DB5942601fa062Cc248aAA153313D3";
const DollarAddress = "0x36F3FD68E7325a35EB768F1AedaAe9EA0689d723";
const EssAddress = "0x24aE124c4CC33D6791F8E8B63520ed7107ac8b3e";
const PairAddress = "0x88ff79eB2Bc5850F27315415da8685282C7610F9";
const PoolAddress = "0x4082d11e506e3250009a991061acd2176077c88f";
const MigratorAddress = "0xC61D12896421613b30D56F85c093CdDa43Ab2CE7";

// Prev Impl Contract
const daoPrevContract = new web3.eth.Contract(prevImplABI, DAOAddress);

// Holder Addresses
const daoOwner = "0x1bba92F379375387bf8F927058da14D47464cB7A";
const etherHolder = "0x06920C9fC643De77B99cB7670A944AD31eaAA260";
const poolUser1 = "0x4f295d8eabfc0e11d99db02bc02a265d82d7ba76";
const poolUser2 = "0x52A5711Dc4fe437E81205bfaD22fFC43F1818Df7";

// Artifacts
const Dollar = artifacts.require("Dollar");
const Pool = artifacts.require("Pool");
const Implementation = artifacts.require("Implementation");
const ERC20 = artifacts.require("ERC20");
let impl, pool, dollar, dao, migrator, ess;

contract("Implementation", function ([user]) {
  before(async function () {
    //fund owner
    await web3.eth.sendTransaction({to: daoOwner, from: etherHolder, value: web3.utils.toWei('1')})

    // Attach contracts
    pool = await Pool.at(PoolAddress);
    dollar = await Dollar.at(DollarAddress);
    univ2 = await ERC20.at(PairAddress);
    ess = await ERC20.at(EssAddress);

    // Deploy new impl
    impl = await Implementation.new();

    // Upgrade the implementation
    await daoPrevContract.methods
      .commit(impl.address)
      .send({ from: daoOwner, gas: 1000000 });

    dao = await Implementation.at(DAOAddress);
  });

  describe("initialize", async function () {
    it("initializes successfully", async function () {
      // mints all withdrawable coupon underlying
      const expectedDollarBalance = new BN("12378881578723891659040747").add(await dao.totalCouponUnderlying());
      expect(await dollar.balanceOf(dao.address)).to.be.bignumber.equal(expectedDollarBalance);

      // sunsets migrator
      expect(await ess.balanceOf(dao.address)).to.be.bignumber.equal(new BN(0));
      expect(await ess.balanceOf(MigratorAddress)).to.be.bignumber.equal(new BN(0));
      expect(await ess.balanceOf(daoOwner)).to.be.bignumber.equal(new BN("710654608442370624605020906"));

      expect(await dao.owner()).to.be.equal(daoOwner);
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
