const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const Dollar = contract.fromArtifact('Dollar');
const TestnetUSDC = contract.fromArtifact('TestnetUSDC');
const MockSettableDAO = contract.fromArtifact('MockSettableDAO');
const MockReserve = contract.fromArtifact('MockReserve');
const MockComptroller = contract.fromArtifact('MockComptroller');

const ONE_BIP = new BN(10).pow(new BN(14));
const ONE_UNIT = ONE_BIP.mul(new BN(10000));
const MAX_256 = new BN(2).pow(new BN(256)).sub(new BN(1));

describe('Reserve', function () {
  const [ ownerAddress, daoAddress, userAddress, poolAddress, token1Address, token2Address ] = accounts;

  beforeEach(async function () {
    this.dollar = await Dollar.new({from: ownerAddress});
    this.dao = await MockSettableDAO.new({from: ownerAddress});
    this.comptroller = await MockComptroller.new(poolAddress, {from: ownerAddress});
    this.reserve = await MockReserve.new(this.dao.address, this.dollar.address, {from: ownerAddress});
    this.reserveCallable = await MockReserve.new(daoAddress, this.dollar.address, {from: ownerAddress});
    this.dollarComptroller = await Dollar.at(await this.comptroller.dollar());
    this.reserveComptroller = await MockReserve.new(this.comptroller.address, this.dollarComptroller.address, {from: ownerAddress});
    await this.comptroller.setReserve(this.reserveComptroller.address);
    this.tokenA = await TestnetUSDC.new({from: ownerAddress});
    this.tokenB = await TestnetUSDC.new({from: ownerAddress});
  });

  describe('registerOrder', function () {
    describe('basic set', function () {
      beforeEach(async function () {
        this.result = await this.reserveCallable.registerOrder(
          token1Address,
          token2Address,
          ONE_BIP.mul(new BN(10000)),
          ONE_BIP.mul(new BN(10000)).mul(new BN(1000)),
          {from: daoAddress});
        this.txHash = this.result.tx;
      });

      it('lists order', async function () {
        const order = await this.reserveCallable.order(token1Address, token2Address);
        expect(order[0]).to.be.bignumber.equal(ONE_BIP.mul(new BN(10000)));
        expect(order[1]).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000)));
      });

      it('emits OrderRegistered event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserve, 'OrderRegistered', {
          makerToken: token1Address,
          takerToken: token2Address,
        });

        expect(event.args.price).to.be.bignumber.equal(ONE_BIP.mul(new BN(10000)));
        expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000)));
      });
    });

    describe('reset', function () {
      beforeEach(async function () {
        await this.reserveCallable.registerOrder(
          token1Address,
          token2Address,
          ONE_BIP.mul(new BN(10000)),
          ONE_UNIT.mul(new BN(1000)),
          {from: daoAddress});
        this.result = await this.reserveCallable.registerOrder(
          token1Address,
          token2Address,
          ONE_BIP.mul(new BN(11000)),
          ONE_UNIT.mul(new BN(2000)),
          {from: daoAddress});
        this.txHash = this.result.tx;
      });

      it('lists order', async function () {
        const order = await this.reserveCallable.order(token1Address, token2Address);
        expect(order[0]).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
        expect(order[1]).to.be.bignumber.equal(ONE_UNIT.mul(new BN(2000)));
      });

      it('emits OrderRegistered event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserve, 'OrderRegistered', {
          makerToken: token1Address,
          takerToken: token2Address,
        });

        expect(event.args.price).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
        expect(event.args.amount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(2000)));
      });
    });

    describe('not dao', function () {
      it('reverts', async function () {
        await expectRevert(this.reserveCallable.registerOrder(
          token1Address,
          token2Address,
          ONE_BIP.mul(new BN(10000)),
          ONE_UNIT.mul(new BN(1000)),
          {from: ownerAddress}), "ReserveComptroller: not dao");
      });
    });
  });

  describe('swap', function () {
    describe('mint and sell', function () {
      beforeEach(async function () {
        await this.comptroller.mintToAccountE(this.comptroller.address, ONE_UNIT.mul(new BN(1000000)), {from: ownerAddress});
        await this.comptroller.setReserveParams(ONE_BIP.mul(new BN(100)), ONE_BIP.mul(new BN(100)), {from: ownerAddress});
        await this.comptroller.setReserveOrder(
          this.dollarComptroller.address,
          this.tokenA.address,
          ONE_BIP.mul(new BN(11000)),
          ONE_UNIT.mul(new BN(1000)),
          {from: ownerAddress});
        await this.tokenA.mint(userAddress, ONE_UNIT.mul(new BN(100000)));
        await this.tokenA.approve(this.reserveComptroller.address, ONE_UNIT.mul(new BN(100000)), {from: userAddress});
      });

      describe('simple swap', function () {
        beforeEach(async function () {
          this.result = await this.reserveComptroller.swap(
            this.dollarComptroller.address,
            this.tokenA.address,
            ONE_UNIT.mul(new BN(1100)),
            {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('performs swap', async function () {
          expect(await this.dollarComptroller.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000)));
          expect(await this.dollarComptroller.balanceOf(this.comptroller.address)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000000)));
          expect(await this.dollarComptroller.balanceOf(this.reserveComptroller.address)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(0)));
          expect(await this.tokenA.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(98900)));
          expect(await this.tokenA.balanceOf(this.comptroller.address)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(0)));
          expect(await this.tokenA.balanceOf(this.reserveComptroller.address)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1100)));

          const order = await this.reserveComptroller.order(this.dollarComptroller.address, this.tokenA.address);
          expect(order[0]).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
          expect(order[1]).to.be.bignumber.equal(ONE_UNIT.mul(new BN(0)));
        });

        it('emits Swap event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockReserve, 'Swap', {
            makerToken: this.dollarComptroller.address,
            takerToken: this.tokenA.address,
          });

          expect(event.args.takerAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1100)));
          expect(event.args.makerAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000)));
        });
      });

      describe('above mint limit', function () {
        it('reverts', async function () {
          await expectRevert(this.reserveComptroller.swap(
            this.dollarComptroller.address,
            this.tokenA.address,
            ONE_UNIT.mul(new BN(22000)),
            {from: userAddress}), "ReserveComptroller: not enough mintable");
        });
      });

      describe('above amount limit', function () {
        it('reverts', async function () {
          await expectRevert(this.reserveComptroller.swap(
            this.dollarComptroller.address,
            this.tokenA.address,
            ONE_UNIT.mul(new BN(1200)),
            {from: userAddress}), "Reserve: amount too large");
        });
      });

      describe('aggr above amount limit', function () {
        beforeEach(async function () {
          await this.reserveComptroller.swap(
            this.dollarComptroller.address,
            this.tokenA.address,
            ONE_UNIT.mul(new BN(600)),
            {from: userAddress});
        });

        it('displays', async function () {
          const order = await this.reserveComptroller.order(this.dollarComptroller.address, this.tokenA.address);
          expect(order[0]).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
          expect(order[1]).to.be.bignumber.equal(new BN("454545454545454545455"));
        });

        it('reverts', async function () {
          await expectRevert(this.reserveComptroller.swap(
            this.dollarComptroller.address,
            this.tokenA.address,
            ONE_UNIT.mul(new BN(600)),
            {from: userAddress}), "Reserve: amount too large");
        });
      });

      describe('infinite amount', function () {
        beforeEach(async function () {
          await this.comptroller.setReserveOrder(
            this.dollarComptroller.address,
            this.tokenA.address,
            ONE_BIP.mul(new BN(11000)),
            MAX_256,
            {from: ownerAddress});
          await this.reserveComptroller.swap(
            this.dollarComptroller.address,
            this.tokenA.address,
            ONE_UNIT.mul(new BN(1100)),
            {from: userAddress});
        });

        it('displays', async function () {
          const order = await this.reserveComptroller.order(this.dollarComptroller.address, this.tokenA.address);
          expect(order[0]).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
          expect(order[1]).to.be.bignumber.equal(MAX_256);
        });
      });
    });

    describe('buy and burn', function () {
      beforeEach(async function () {
        await this.comptroller.mintToAccountE(this.comptroller.address, ONE_UNIT.mul(new BN(900000)), {from: ownerAddress});
        await this.comptroller.setReserveParams(ONE_BIP.mul(new BN(100)), ONE_BIP.mul(new BN(100)), {from: ownerAddress});
        await this.comptroller.setReserveOrder(
          this.tokenA.address,
          this.dollarComptroller.address,
          ONE_BIP.mul(new BN(11000)),
          ONE_UNIT.mul(new BN(1000)),
          {from: ownerAddress});
        await this.tokenA.mint(this.reserveComptroller.address, ONE_UNIT.mul(new BN(20000)));
        await this.comptroller.mintToAccountE(userAddress, ONE_UNIT.mul(new BN(100000)));
        await this.dollarComptroller.approve(this.reserveComptroller.address, ONE_UNIT.mul(new BN(100000)), {from: userAddress});
      });

      describe('simple swap', function () {
        beforeEach(async function () {
          this.result = await this.reserveComptroller.swap(
            this.tokenA.address,
            this.dollarComptroller.address,
            ONE_UNIT.mul(new BN(1100)),
            {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('performs swap', async function () {
          expect(await this.dollarComptroller.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(98900)));
          expect(await this.dollarComptroller.balanceOf(this.comptroller.address)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(900000)));
          expect(await this.dollarComptroller.balanceOf(this.reserveComptroller.address)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(0)));
          expect(await this.tokenA.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000)));
          expect(await this.tokenA.balanceOf(this.comptroller.address)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(0)));
          expect(await this.tokenA.balanceOf(this.reserveComptroller.address)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(19000)));

          const order = await this.reserveComptroller.order(this.tokenA.address, this.dollarComptroller.address);
          expect(order[0]).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
          expect(order[1]).to.be.bignumber.equal(ONE_UNIT.mul(new BN(0)));
        });

        it('emits Swap event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockReserve, 'Swap', {
            makerToken: this.tokenA.address,
            takerToken: this.dollarComptroller.address,
          });

          expect(event.args.takerAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1100)));
          expect(event.args.makerAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000)));
        });
      });

      describe('above burn limit', function () {
        it('reverts', async function () {
          await expectRevert(this.reserveComptroller.swap(
            this.tokenA.address,
            this.dollarComptroller.address,
            ONE_UNIT.mul(new BN(22000)),
            {from: userAddress}), "ReserveComptroller: not enough burnable");
        });
      });

      describe('above amount limit', function () {
        it('reverts', async function () {
          await expectRevert(this.reserveComptroller.swap(
            this.tokenA.address,
            this.dollarComptroller.address,
            ONE_UNIT.mul(new BN(1200)),
            {from: userAddress}), "Reserve: amount too large");
        });
      });

      describe('aggr above amount limit', function () {
        beforeEach(async function () {
          await this.reserveComptroller.swap(
            this.tokenA.address,
            this.dollarComptroller.address,
            ONE_UNIT.mul(new BN(600)),
            {from: userAddress});
        });

        it('displays', async function () {
          const order = await this.reserveComptroller.order(this.tokenA.address, this.dollarComptroller.address);
          expect(order[0]).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
          expect(order[1]).to.be.bignumber.equal(new BN("454545454545454545455"));
        });

        it('reverts', async function () {
          await expectRevert(this.reserveComptroller.swap(
            this.tokenA.address,
            this.dollarComptroller.address,
            ONE_UNIT.mul(new BN(600)),
            {from: userAddress}), "Reserve: amount too large");
        });
      });

      describe('infinite amount', function () {
        beforeEach(async function () {
          await this.comptroller.setReserveOrder(
            this.tokenA.address,
            this.dollarComptroller.address,
            ONE_BIP.mul(new BN(11000)),
            MAX_256,
            {from: ownerAddress});
          await this.reserveComptroller.swap(
            this.tokenA.address,
            this.dollarComptroller.address,
            ONE_UNIT.mul(new BN(1000)),
            {from: userAddress});
        });

        it('displays', async function () {
          const order = await this.reserveComptroller.order(this.tokenA.address, this.dollarComptroller.address);
          expect(order[0]).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
          expect(order[1]).to.be.bignumber.equal(MAX_256);
        });
      });
    });

    describe('trade', function () {
      beforeEach(async function () {
        await this.comptroller.setReserveOrder(
          this.tokenB.address,
          this.tokenA.address,
          ONE_BIP.mul(new BN(11000)),
          ONE_UNIT.mul(new BN(1000)),
          {from: daoAddress});
        await this.tokenA.mint(userAddress, ONE_UNIT.mul(new BN(100000)));
        await this.tokenA.approve(this.reserveComptroller.address, ONE_UNIT.mul(new BN(100000)), {from: userAddress});
        await this.tokenB.mint(this.reserveComptroller.address, ONE_UNIT.mul(new BN(100000)));
      });

      describe('simple swap', function () {
        beforeEach(async function () {
          this.result = await this.reserveComptroller.swap(
            this.tokenB.address,
            this.tokenA.address,
            ONE_UNIT.mul(new BN(1100)),
            {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('performs swap', async function () {
          expect(await this.tokenB.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000)));
          expect(await this.tokenB.balanceOf(this.reserveComptroller.address)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(99000)));
          expect(await this.tokenA.balanceOf(userAddress)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(98900)));
          expect(await this.tokenA.balanceOf(this.reserveComptroller.address)).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1100)));

          const order = await this.reserveComptroller.order(this.tokenB.address, this.tokenA.address);
          expect(order[0]).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
          expect(order[1]).to.be.bignumber.equal(ONE_UNIT.mul(new BN(0)));
        });

        it('emits Swap event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockReserve, 'Swap', {
            makerToken: this.tokenB.address,
            takerToken: this.tokenA.address,
          });

          expect(event.args.takerAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1100)));
          expect(event.args.makerAmount).to.be.bignumber.equal(ONE_UNIT.mul(new BN(1000)));
        });
      });

      describe('above amount limit', function () {
        it('reverts', async function () {
          await expectRevert(this.reserveComptroller.swap(
            this.tokenB.address,
            this.tokenA.address,
            ONE_UNIT.mul(new BN(1200)),
            {from: userAddress}), "Reserve: amount too large");
        });
      });

      describe('aggr above amount limit', function () {
        beforeEach(async function () {
          await this.reserveComptroller.swap(
            this.tokenB.address,
            this.tokenA.address,
            ONE_UNIT.mul(new BN(600)),
            {from: userAddress});
        });

        it('displays', async function () {
          const order = await this.reserveComptroller.order(this.tokenB.address, this.tokenA.address);
          expect(order[0]).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
          expect(order[1]).to.be.bignumber.equal(new BN("454545454545454545455"));
        });

        it('reverts', async function () {
          await expectRevert(this.reserveComptroller.swap(
            this.tokenB.address,
            this.tokenA.address,
            ONE_UNIT.mul(new BN(600)),
            {from: userAddress}), "Reserve: amount too large");
        });
      });

      describe('infinite amount', function () {
        beforeEach(async function () {
          await this.comptroller.setReserveOrder(
            this.tokenB.address,
            this.tokenA.address,
            ONE_BIP.mul(new BN(11000)),
            MAX_256,
            {from: ownerAddress});
          await this.reserveComptroller.swap(
            this.tokenB.address,
            this.tokenA.address,
            ONE_UNIT.mul(new BN(1100)),
            {from: userAddress});
        });

        it('displays', async function () {
          const order = await this.reserveComptroller.order(this.tokenB.address, this.tokenA.address);
          expect(order[0]).to.be.bignumber.equal(ONE_BIP.mul(new BN(11000)));
          expect(order[1]).to.be.bignumber.equal(MAX_256);
        });
      });
    });
  });
});