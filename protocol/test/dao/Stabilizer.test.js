const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, time, expectEvent } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockStabilizer = contract.fromArtifact('MockStabilizer');
const Dollar = contract.fromArtifact('Dollar');

const ONE = new BN(10).pow(new BN(18));
const ONE_MILLION = ONE.mul(new BN(1000000));

describe('Stabilizer', function () {
  const [ ownerAddress, poolAddress, circulating ] = accounts;

  beforeEach(async function () {
    this.stabilizer = await MockStabilizer.new(poolAddress, {from: ownerAddress, gas: 8000000});
    this.dollar = await Dollar.at(await this.stabilizer.dollar());
  });

  describe('step', function () {
    describe('no bonded', function () {
      beforeEach(async function () {
        await this.stabilizer.mintToE(circulating, ONE_MILLION);
        await this.stabilizer.incrementEpochE();

        this.result = await this.stabilizer.stepE();
        this.txHash = this.result.tx;

        this.stabilityReward = ONE.mul(new BN(30));
      });

      it('doesnt mint new Dollar tokens', async function () {
        expect(await this.dollar.totalSupply()).to.be.bignumber.equal(ONE_MILLION);
        expect(await this.dollar.balanceOf(this.stabilizer.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.dollar.balanceOf(circulating)).to.be.bignumber.equal(ONE_MILLION);
      });

      it('updates total redeemable', async function () {
        expect(await this.stabilizer.totalBonded()).to.be.bignumber.equal(new BN(0));
        expect(await this.stabilizer.totalSupply()).to.be.bignumber.equal(new BN(0));
        expect(await this.stabilizer.totalDebt()).to.be.bignumber.equal(new BN(0));
      });

      it('emits StabilityReward event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockStabilizer, 'StabilityReward', {});

        expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
        expect(event.args.rate).to.be.bignumber.equal(this.stabilityReward.divn(1000000));
        expect(event.args.amount).to.be.bignumber.equal(new BN(0));
      });
    });

    describe('bonded', function () {
      beforeEach(async function () {
        await this.stabilizer.mintToE(circulating, ONE_MILLION);
        await this.stabilizer.mintToE(this.stabilizer.address, ONE_MILLION);
        await this.stabilizer.incrementTotalBondedE(ONE_MILLION);

        await this.stabilizer.incrementEpochE();
      });

      describe('no debt', function () {
        beforeEach(async function () {
          this.result = await this.stabilizer.stepE();
          this.txHash = this.result.tx;

          this.stabilityReward = ONE.mul(new BN(30));
        });

        it('doesnt mint new Dollar tokens', async function () {
          expect(await this.dollar.totalSupply()).to.be.bignumber.equal(ONE_MILLION.muln(2).add(this.stabilityReward));
          expect(await this.dollar.balanceOf(this.stabilizer.address)).to.be.bignumber.equal(ONE_MILLION.add(this.stabilityReward));
          expect(await this.dollar.balanceOf(circulating)).to.be.bignumber.equal(ONE_MILLION);
        });

        it('updates total redeemable', async function () {
          expect(await this.stabilizer.totalBonded()).to.be.bignumber.equal(ONE_MILLION.add(this.stabilityReward));
          expect(await this.stabilizer.totalSupply()).to.be.bignumber.equal(new BN(0));
          expect(await this.stabilizer.totalDebt()).to.be.bignumber.equal(new BN(0));
        });

        it('emits StabilityReward event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockStabilizer, 'StabilityReward', {});

          expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
          expect(event.args.rate).to.be.bignumber.equal(this.stabilityReward.divn(1000000));
          expect(event.args.amount).to.be.bignumber.equal(new BN(this.stabilityReward));
        });
      });

      describe('some debt', function () {
        beforeEach(async function () {
          this.debt = ONE.muln(200000);
          await this.stabilizer.incrementTotalDebtE(this.debt); // 10% debt ratio

          this.result = await this.stabilizer.stepE();
          this.txHash = this.result.tx;

          this.stabilityReward = ONE.mul(new BN(30 + 50));
        });

        it('doesnt mint new Dollar tokens', async function () {
          expect(await this.dollar.totalSupply()).to.be.bignumber.equal(ONE_MILLION.muln(2).add(this.stabilityReward));
          expect(await this.dollar.balanceOf(this.stabilizer.address)).to.be.bignumber.equal(ONE_MILLION.add(this.stabilityReward));
          expect(await this.dollar.balanceOf(circulating)).to.be.bignumber.equal(ONE_MILLION);
        });

        it('updates total redeemable', async function () {
          expect(await this.stabilizer.totalBonded()).to.be.bignumber.equal(ONE_MILLION.add(this.stabilityReward));
          expect(await this.stabilizer.totalSupply()).to.be.bignumber.equal(new BN(0));
          expect(await this.stabilizer.totalDebt()).to.be.bignumber.equal(this.debt);
        });

        it('emits StabilityReward event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockStabilizer, 'StabilityReward', {});

          expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
          expect(event.args.rate).to.be.bignumber.equal(this.stabilityReward.divn(1000000));
          expect(event.args.amount).to.be.bignumber.equal(new BN(this.stabilityReward));
        });
      });

      describe('max debt', function () {
        beforeEach(async function () {
          this.debt = ONE.muln(400000);
          await this.stabilizer.incrementTotalDebtE(this.debt); // 20% debt ratio

          this.result = await this.stabilizer.stepE();
          this.txHash = this.result.tx;

          this.stabilityReward = ONE.mul(new BN(30 + 100));
        });

        it('doesnt mint new Dollar tokens', async function () {
          expect(await this.dollar.totalSupply()).to.be.bignumber.equal(ONE_MILLION.muln(2).add(this.stabilityReward));
          expect(await this.dollar.balanceOf(this.stabilizer.address)).to.be.bignumber.equal(ONE_MILLION.add(this.stabilityReward));
          expect(await this.dollar.balanceOf(circulating)).to.be.bignumber.equal(ONE_MILLION);
        });

        it('updates total redeemable', async function () {
          expect(await this.stabilizer.totalBonded()).to.be.bignumber.equal(ONE_MILLION.add(this.stabilityReward));
          expect(await this.stabilizer.totalSupply()).to.be.bignumber.equal(new BN(0));
          expect(await this.stabilizer.totalDebt()).to.be.bignumber.equal( this.debt);
        });

        it('emits StabilityReward event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockStabilizer, 'StabilityReward', {});

          expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
          expect(event.args.rate).to.be.bignumber.equal(this.stabilityReward.divn(1000000));
          expect(event.args.amount).to.be.bignumber.equal(new BN(this.stabilityReward));
        });
      });

      describe('above max debt', function () {
        beforeEach(async function () {
          this.debt = ONE.muln(1000000);
          await this.stabilizer.incrementTotalDebtE(this.debt); // 50% debt ratio

          this.result = await this.stabilizer.stepE();
          this.txHash = this.result.tx;

          this.stabilityReward = ONE.mul(new BN(30 + 100));
        });

        it('doesnt mint new Dollar tokens', async function () {
          expect(await this.dollar.totalSupply()).to.be.bignumber.equal(ONE_MILLION.muln(2).add(this.stabilityReward));
          expect(await this.dollar.balanceOf(this.stabilizer.address)).to.be.bignumber.equal(ONE_MILLION.add(this.stabilityReward));
          expect(await this.dollar.balanceOf(circulating)).to.be.bignumber.equal(ONE_MILLION);
        });

        it('updates total redeemable', async function () {
          expect(await this.stabilizer.totalBonded()).to.be.bignumber.equal(ONE_MILLION.add(this.stabilityReward));
          expect(await this.stabilizer.totalSupply()).to.be.bignumber.equal(new BN(0));
          expect(await this.stabilizer.totalDebt()).to.be.bignumber.equal( this.debt);
        });

        it('emits StabilityReward event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockStabilizer, 'StabilityReward', {});

          expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
          expect(event.args.rate).to.be.bignumber.equal(this.stabilityReward.divn(1000000));
          expect(event.args.amount).to.be.bignumber.equal(new BN(this.stabilityReward));
        });
      });
    });
  });
});