const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockBonding = contract.fromArtifact('MockBonding');
const Dollar = contract.fromArtifact('Dollar');

const INITIAL_STAKE_MULTIPLE = new BN(10).pow(new BN(6)); // 100 ESD -> 100M ESDS

const FROZEN = new BN(0);
const FLUID = new BN(1);
const LOCKED = new BN(2);

describe('Bonding', function () {
  const [ ownerAddress, userAddress, userAddress1, userAddress2 ] = accounts;

  beforeEach(async function () {
    this.bonding = await MockBonding.new({from: ownerAddress, gas: 8000000});
    this.dollar = await Dollar.at(await this.bonding.dollar());

    await this.bonding.setEpochParamsE(await time.latest(), 86400);
    await time.increase(86400);
    await this.bonding.stepE();
  });

  describe('frozen', function () {
    describe('starts as frozen', function () {
      it('mints new Dollar tokens', async function () {
        expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FROZEN);
      });
    });

    describe('when deposit', function () {
      beforeEach(async function () {
        await this.bonding.mintToE(userAddress, 1000);
        await this.dollar.approve(this.bonding.address, 1000, {from: userAddress});

        this.result = await this.bonding.deposit(1000, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('is frozen', async function () {
        expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FROZEN);
      });

      it('updates users balances', async function () {
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.bonding.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.bonding.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(1000));
        expect(await this.bonding.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(0));
      });

      it('updates dao balances', async function () {
        expect(await this.dollar.balanceOf(this.bonding.address)).to.be.bignumber.equal(new BN(1000));
        expect(await this.bonding.totalSupply()).to.be.bignumber.equal(new BN(0));
        expect(await this.bonding.totalBonded()).to.be.bignumber.equal(new BN(0));
        expect(await this.bonding.totalStaged()).to.be.bignumber.equal(new BN(1000));
      });

      it('emits Deposit event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Deposit', {
          account: userAddress
        });

        expect(event.args.value).to.be.bignumber.equal(new BN(1000));
      });
    });

    describe('when withdraw', function () {
      beforeEach(async function () {
        await this.bonding.mintToE(userAddress, 1000);
        await this.dollar.approve(this.bonding.address, 1000, {from: userAddress});
        await this.bonding.deposit(1000, {from: userAddress});

        this.result = await this.bonding.withdraw(1000, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('is frozen', async function () {
        expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FROZEN);
      });

      it('updates users balances', async function () {
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(1000));
        expect(await this.bonding.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.bonding.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.bonding.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(0));
      });

      it('updates dao balances', async function () {
        expect(await this.dollar.balanceOf(this.bonding.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.bonding.totalSupply()).to.be.bignumber.equal(new BN(0));
        expect(await this.bonding.totalBonded()).to.be.bignumber.equal(new BN(0));
        expect(await this.bonding.totalStaged()).to.be.bignumber.equal(new BN(0));
      });

      it('emits Withdraw event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Withdraw', {
          account: userAddress
        });

        expect(event.args.value).to.be.bignumber.equal(new BN(1000));
      });
    });

    describe('when withdraw too much', function () {
      beforeEach(async function () {
        await this.bonding.mintToE(userAddress, 1000);
        await this.dollar.approve(this.bonding.address, 1000, {from: userAddress});
        await this.bonding.deposit(1000, {from: userAddress});

        await this.bonding.mintToE(userAddress1, 10000);
        await this.dollar.approve(this.bonding.address, 10000, {from: userAddress1});
        await this.bonding.deposit(10000, {from: userAddress1});
      });

      it('reverts', async function () {
        await expectRevert(this.bonding.withdraw(2000, {from: userAddress}), "insufficient staged balance");
      });
    });

    describe('when bond', function () {
      describe('simple', function () {
        beforeEach(async function () {
          await this.bonding.mintToE(userAddress, 1000);
          await this.dollar.approve(this.bonding.address, 1000, {from: userAddress});
          await this.bonding.deposit(1000, {from: userAddress});

          this.result = await this.bonding.bond(1000, {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('is fluid', async function () {
          expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
        });

        it('updates users balances', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.bonding.balanceOf(userAddress)).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
          expect(await this.bonding.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.bonding.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(1000));
        });

        it('updates dao balances', async function () {
          expect(await this.dollar.balanceOf(this.bonding.address)).to.be.bignumber.equal(new BN(1000));
          expect(await this.bonding.totalSupply()).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
          expect(await this.bonding.totalBonded()).to.be.bignumber.equal(new BN(1000));
          expect(await this.bonding.totalStaged()).to.be.bignumber.equal(new BN(0));
        });

        it('emits Bond event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Bond', {
            account: userAddress
          });

          expect(event.args.start).to.be.bignumber.equal(new BN(2));
          expect(event.args.value).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
          expect(event.args.valueUnderlying).to.be.bignumber.equal(new BN(1000));
        });

        it('emits Transfer event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Transfer', {
            from: ZERO_ADDRESS,
            to: userAddress
          });

          expect(event.args.value).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
        });
      });

      describe('partial', function () {
        beforeEach(async function () {
          await this.bonding.mintToE(userAddress, 1000);
          await this.dollar.approve(this.bonding.address, 1000, {from: userAddress});
          await this.bonding.deposit(800, {from: userAddress});

          this.result = await this.bonding.bond(500, {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('is fluid', async function () {
          expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
        });

        it('updates users balances', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(200));
          expect(await this.bonding.balanceOf(userAddress)).to.be.bignumber.equal(new BN(500).mul(INITIAL_STAKE_MULTIPLE));
          expect(await this.bonding.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(300));
          expect(await this.bonding.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(500));
        });

        it('updates dao balances', async function () {
          expect(await this.dollar.balanceOf(this.bonding.address)).to.be.bignumber.equal(new BN(800));
          expect(await this.bonding.totalSupply()).to.be.bignumber.equal(new BN(500).mul(INITIAL_STAKE_MULTIPLE));
          expect(await this.bonding.totalBonded()).to.be.bignumber.equal(new BN(500));
          expect(await this.bonding.totalStaged()).to.be.bignumber.equal(new BN(300));
        });

        it('emits Bond event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Bond', {
            account: userAddress
          });

          expect(event.args.start).to.be.bignumber.equal(new BN(2));
          expect(event.args.value).to.be.bignumber.equal(new BN(500).mul(INITIAL_STAKE_MULTIPLE));
          expect(event.args.valueUnderlying).to.be.bignumber.equal(new BN(500));
        });

        it('emits Transfer event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Transfer', {
            from: ZERO_ADDRESS,
            to: userAddress
          });

          expect(event.args.value).to.be.bignumber.equal(new BN(500).mul(INITIAL_STAKE_MULTIPLE));
        });
      });

      describe('multiple', function () {
        beforeEach(async function () {
          await this.bonding.mintToE(userAddress1, 1000);
          await this.dollar.approve(this.bonding.address, 1000, {from: userAddress1});
          await this.bonding.deposit(1000, {from: userAddress1});

          await this.bonding.mintToE(userAddress2, 1000);
          await this.dollar.approve(this.bonding.address, 1000, {from: userAddress2});
          await this.bonding.deposit(1000, {from: userAddress2});

          await this.bonding.bond(600, {from: userAddress1});
          await this.bonding.bond(400, {from: userAddress2});

          await this.bonding.incrementEpochE({from: userAddress});
          await this.bonding.mintToE(this.bonding.address, 1000);
          await this.bonding.incrementTotalBondedE(1000);

          await this.bonding.mintToE(userAddress, 1000);
          await this.dollar.approve(this.bonding.address, 800, {from: userAddress});
          await this.bonding.deposit(800, {from: userAddress});

          this.result = await this.bonding.bond(500, {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('is frozen', async function () {
          expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
        });

        it('updates users balances', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(200));
          expect(await this.bonding.balanceOf(userAddress)).to.be.bignumber.equal(new BN(250).mul(INITIAL_STAKE_MULTIPLE));
          expect(await this.bonding.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(300));
          expect(await this.bonding.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(500));
        });

        it('updates dao balances', async function () {
          expect(await this.dollar.balanceOf(this.bonding.address)).to.be.bignumber.equal(new BN(3800));
          expect(await this.bonding.totalSupply()).to.be.bignumber.equal(new BN(1250).mul(INITIAL_STAKE_MULTIPLE));
          expect(await this.bonding.totalBonded()).to.be.bignumber.equal(new BN(2500));
          expect(await this.bonding.totalStaged()).to.be.bignumber.equal(new BN(1300));
        });

        it('emits Bond event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Bond', {
            account: userAddress
          });

          expect(event.args.start).to.be.bignumber.equal(new BN(3));
          expect(event.args.value).to.be.bignumber.equal(new BN(250).mul(INITIAL_STAKE_MULTIPLE));
          expect(event.args.valueUnderlying).to.be.bignumber.equal(new BN(500));
        });

        it('emits Transfer event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Transfer', {
            from: ZERO_ADDRESS,
            to: userAddress
          });

          expect(event.args.value).to.be.bignumber.equal(new BN(250).mul(INITIAL_STAKE_MULTIPLE));
        });
      });
    });

    describe('when unbond', function () {
      beforeEach(async function () {
        await this.bonding.mintToE(userAddress, 1000);
        await this.dollar.approve(this.bonding.address, 1000, {from: userAddress});
        await this.bonding.deposit(1000, {from: userAddress});

        await this.bonding.bond(1000, {from: userAddress});
        await this.bonding.incrementEpochE({from: userAddress});
      });

      describe('simple', function () {
        beforeEach(async function () {
          this.result = await this.bonding.unbond(new BN(1000).mul(INITIAL_STAKE_MULTIPLE), {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('is fluid', async function () {
          expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
        });

        it('updates users balances', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.bonding.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.bonding.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(1000));
          expect(await this.bonding.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(0));
        });

        it('updates dao balances', async function () {
          expect(await this.dollar.balanceOf(this.bonding.address)).to.be.bignumber.equal(new BN(1000));
          expect(await this.bonding.totalSupply()).to.be.bignumber.equal(new BN(0));
          expect(await this.bonding.totalBonded()).to.be.bignumber.equal(new BN(0));
          expect(await this.bonding.totalStaged()).to.be.bignumber.equal(new BN(1000));
        });

        it('emits Unbond event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Unbond', {
            account: userAddress
          });

          expect(event.args.start).to.be.bignumber.equal(new BN(3));
          expect(event.args.value).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
          expect(event.args.valueUnderlying).to.be.bignumber.equal(new BN(1000));
        });

        it('emits Transfer event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Transfer', {
            from: userAddress,
            to: ZERO_ADDRESS
          });

          expect(event.args.value).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
        });
      });

      describe('partial', function () {
        beforeEach(async function () {
          this.result = await this.bonding.unbond(new BN(800).mul(INITIAL_STAKE_MULTIPLE), {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('is fluid', async function () {
          expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
        });

        it('updates users balances', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.bonding.balanceOf(userAddress)).to.be.bignumber.equal(new BN(200).mul(INITIAL_STAKE_MULTIPLE));
          expect(await this.bonding.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(800));
          expect(await this.bonding.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(200));
        });

        it('updates dao balances', async function () {
          expect(await this.dollar.balanceOf(this.bonding.address)).to.be.bignumber.equal(new BN(1000));
          expect(await this.bonding.totalSupply()).to.be.bignumber.equal(new BN(200).mul(INITIAL_STAKE_MULTIPLE));
          expect(await this.bonding.totalBonded()).to.be.bignumber.equal(new BN(200));
          expect(await this.bonding.totalStaged()).to.be.bignumber.equal(new BN(800));
        });

        it('emits Unbond event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Unbond', {
            account: userAddress
          });

          expect(event.args.start).to.be.bignumber.equal(new BN(3));
          expect(event.args.value).to.be.bignumber.equal(new BN(800).mul(INITIAL_STAKE_MULTIPLE));
          expect(event.args.valueUnderlying).to.be.bignumber.equal(new BN(800));
        });

        it('emits Transfer event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Transfer', {
            from: userAddress,
            to: ZERO_ADDRESS
          });

          expect(event.args.value).to.be.bignumber.equal(new BN(800).mul(INITIAL_STAKE_MULTIPLE));
        });
      });

      describe('multiple', function () {
        beforeEach(async function () {
          await this.bonding.mintToE(userAddress1, 1000);
          await this.dollar.approve(this.bonding.address, 1000, {from: userAddress1});
          await this.bonding.deposit(1000, {from: userAddress1});

          await this.bonding.mintToE(userAddress2, 1000);
          await this.dollar.approve(this.bonding.address, 1000, {from: userAddress2});
          await this.bonding.deposit(1000, {from: userAddress2});

          await this.bonding.bond(600, {from: userAddress1});
          await this.bonding.bond(400, {from: userAddress2});

          await this.bonding.incrementEpochE({from: userAddress});
          await this.bonding.mintToE(this.bonding.address, 1000);
          await this.bonding.incrementTotalBondedE(1000);

          this.result = await this.bonding.unbond(new BN(800).mul(INITIAL_STAKE_MULTIPLE), {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('is frozen', async function () {
          expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
        });

        it('updates users balances', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.bonding.balanceOf(userAddress)).to.be.bignumber.equal(new BN(200).mul(INITIAL_STAKE_MULTIPLE));
          expect(await this.bonding.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(1200));
          expect(await this.bonding.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(300));
        });

        it('updates dao balances', async function () {
          expect(await this.dollar.balanceOf(this.bonding.address)).to.be.bignumber.equal(new BN(4000));
          expect(await this.bonding.totalSupply()).to.be.bignumber.equal(new BN(1200).mul(INITIAL_STAKE_MULTIPLE));
          expect(await this.bonding.totalBonded()).to.be.bignumber.equal(new BN(1800));
          expect(await this.bonding.totalStaged()).to.be.bignumber.equal(new BN(2200));
        });

        it('emits Unbond event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Unbond', {
            account: userAddress
          });

          expect(event.args.start).to.be.bignumber.equal(new BN(4));
          expect(event.args.value).to.be.bignumber.equal(new BN(800).mul(INITIAL_STAKE_MULTIPLE));
          expect(event.args.valueUnderlying).to.be.bignumber.equal(new BN(1200));
        });

        it('emits Transfer event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Transfer', {
            from: userAddress,
            to: ZERO_ADDRESS
          });

          expect(event.args.value).to.be.bignumber.equal(new BN(800).mul(INITIAL_STAKE_MULTIPLE));
        });
      });
    });

    describe('when unbondUnderlying', function () {
      beforeEach(async function () {
        await this.bonding.mintToE(userAddress, 1000);
        await this.dollar.approve(this.bonding.address, 1000, {from: userAddress});
        await this.bonding.deposit(1000, {from: userAddress});

        await this.bonding.bond(1000, {from: userAddress});
        await this.bonding.incrementEpochE({from: userAddress});
      });

      describe('simple', function () {
        beforeEach(async function () {
          this.result = await this.bonding.unbondUnderlying(1000, {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('is fluid', async function () {
          expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
        });

        it('updates users balances', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.bonding.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.bonding.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(1000));
          expect(await this.bonding.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(0));
        });

        it('updates dao balances', async function () {
          expect(await this.dollar.balanceOf(this.bonding.address)).to.be.bignumber.equal(new BN(1000));
          expect(await this.bonding.totalSupply()).to.be.bignumber.equal(new BN(0));
          expect(await this.bonding.totalBonded()).to.be.bignumber.equal(new BN(0));
          expect(await this.bonding.totalStaged()).to.be.bignumber.equal(new BN(1000));
        });

        it('emits Unbond event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Unbond', {
            account: userAddress
          });

          expect(event.args.start).to.be.bignumber.equal(new BN(3));
          expect(event.args.value).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
          expect(event.args.valueUnderlying).to.be.bignumber.equal(new BN(1000));
        });

        it('emits Transfer event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Transfer', {
            from: userAddress,
            to: ZERO_ADDRESS
          });

          expect(event.args.value).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
        });
      });

      describe('partial', function () {
        beforeEach(async function () {
          this.result = await this.bonding.unbondUnderlying(800, {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('is fluid', async function () {
          expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
        });

        it('updates users balances', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.bonding.balanceOf(userAddress)).to.be.bignumber.equal(new BN(200).mul(INITIAL_STAKE_MULTIPLE));
          expect(await this.bonding.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(800));
          expect(await this.bonding.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(200));
        });

        it('updates dao balances', async function () {
          expect(await this.dollar.balanceOf(this.bonding.address)).to.be.bignumber.equal(new BN(1000));
          expect(await this.bonding.totalSupply()).to.be.bignumber.equal(new BN(200).mul(INITIAL_STAKE_MULTIPLE));
          expect(await this.bonding.totalBonded()).to.be.bignumber.equal(new BN(200));
          expect(await this.bonding.totalStaged()).to.be.bignumber.equal(new BN(800));
        });

        it('emits Unbond event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Unbond', {
            account: userAddress
          });

          expect(event.args.start).to.be.bignumber.equal(new BN(3));
          expect(event.args.value).to.be.bignumber.equal(new BN(800).mul(INITIAL_STAKE_MULTIPLE));
          expect(event.args.valueUnderlying).to.be.bignumber.equal(new BN(800));
        });

        it('emits Transfer event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Transfer', {
            from: userAddress,
            to: ZERO_ADDRESS
          });

          expect(event.args.value).to.be.bignumber.equal(new BN(800).mul(INITIAL_STAKE_MULTIPLE));
        });
      });

      describe('multiple', function () {
        beforeEach(async function () {
          await this.bonding.mintToE(userAddress1, 1000);
          await this.dollar.approve(this.bonding.address, 1000, {from: userAddress1});
          await this.bonding.deposit(1000, {from: userAddress1});

          await this.bonding.mintToE(userAddress2, 1000);
          await this.dollar.approve(this.bonding.address, 1000, {from: userAddress2});
          await this.bonding.deposit(1000, {from: userAddress2});

          await this.bonding.bond(600, {from: userAddress1});
          await this.bonding.bond(400, {from: userAddress2});

          await this.bonding.incrementEpochE({from: userAddress});
          await this.bonding.mintToE(this.bonding.address, 1000);
          await this.bonding.incrementTotalBondedE(1000);

          this.result = await this.bonding.unbondUnderlying(800, {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('is frozen', async function () {
          expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
        });

        it('updates users balances', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.bonding.balanceOf(userAddress)).to.be.bignumber.equal(new BN(466666667));
          expect(await this.bonding.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(800));
          expect(await this.bonding.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(700));
        });

        it('updates dao balances', async function () {
          expect(await this.dollar.balanceOf(this.bonding.address)).to.be.bignumber.equal(new BN(4000));
          expect(await this.bonding.totalSupply()).to.be.bignumber.equal(new BN(1466666667));
          expect(await this.bonding.totalBonded()).to.be.bignumber.equal(new BN(2200));
          expect(await this.bonding.totalStaged()).to.be.bignumber.equal(new BN(1800));
        });

        it('emits Unbond event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Unbond', {
            account: userAddress
          });

          expect(event.args.start).to.be.bignumber.equal(new BN(4));
          expect(event.args.value).to.be.bignumber.equal(new BN(533333333));
          expect(event.args.valueUnderlying).to.be.bignumber.equal(new BN(800));
        });

        it('emits Transfer event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Transfer', {
            from: userAddress,
            to: ZERO_ADDRESS
          });

          expect(event.args.value).to.be.bignumber.equal(new BN(533333333));
        });
      });
    });
  });

  describe('fluid', function () {
    beforeEach(async function () {
      await this.bonding.mintToE(userAddress, 1000);
      await this.dollar.approve(this.bonding.address, 1000, {from: userAddress});
      await this.bonding.deposit(1000, {from: userAddress});

      await this.bonding.bond(500, {from: userAddress});
    });

    it('is fluid', async function () {
      expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
    });

    describe('when deposit', function () {
      it('reverts', async function () {
        await expectRevert(this.bonding.deposit(1000, {from: userAddress}), "Permission: Not frozen");
      });
    });

    describe('when withdraw', function () {
      it('reverts', async function () {
        await expectRevert(this.bonding.withdraw(1000, {from: userAddress}), "Permission: Not frozen");
      });
    });

    describe('when bond', function () {
      beforeEach(async function () {
        this.result = await this.bonding.bond(500, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('is fluid', async function () {
        expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
      });

      it('updates users balances', async function () {
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.bonding.balanceOf(userAddress)).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
        expect(await this.bonding.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.bonding.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(1000));
      });

      it('updates dao balances', async function () {
        expect(await this.dollar.balanceOf(this.bonding.address)).to.be.bignumber.equal(new BN(1000));
        expect(await this.bonding.totalSupply()).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
        expect(await this.bonding.totalBonded()).to.be.bignumber.equal(new BN(1000));
        expect(await this.bonding.totalStaged()).to.be.bignumber.equal(new BN(0));
      });

      it('emits Bond event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Bond', {
          account: userAddress
        });

        expect(event.args.start).to.be.bignumber.equal(new BN(2));
        expect(event.args.value).to.be.bignumber.equal(new BN(500).mul(INITIAL_STAKE_MULTIPLE));
        expect(event.args.valueUnderlying).to.be.bignumber.equal(new BN(500));
      });

      it('emits Transfer event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Transfer', {
          from: ZERO_ADDRESS,
          to: userAddress
        });

        expect(event.args.value).to.be.bignumber.equal(new BN(500).mul(INITIAL_STAKE_MULTIPLE));
      });
    });

    describe('when unbond', function () {
      beforeEach(async function () {
        this.result = await this.bonding.unbond(new BN(500).mul(INITIAL_STAKE_MULTIPLE), {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('is fluid', async function () {
        expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
      });

      it('updates users balances', async function () {
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.bonding.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.bonding.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(1000));
        expect(await this.bonding.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(0));
      });

      it('updates dao balances', async function () {
        expect(await this.dollar.balanceOf(this.bonding.address)).to.be.bignumber.equal(new BN(1000));
        expect(await this.bonding.totalSupply()).to.be.bignumber.equal(new BN(0));
        expect(await this.bonding.totalBonded()).to.be.bignumber.equal(new BN(0));
        expect(await this.bonding.totalStaged()).to.be.bignumber.equal(new BN(1000));
      });

      it('emits Unbond event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Unbond', {
          account: userAddress
        });

        expect(event.args.start).to.be.bignumber.equal(new BN(2));
        expect(event.args.value).to.be.bignumber.equal(new BN(500).mul(INITIAL_STAKE_MULTIPLE));
        expect(event.args.valueUnderlying).to.be.bignumber.equal(new BN(500));
      });

      it('emits Transfer event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockBonding, 'Transfer', {
          from: userAddress,
          to: ZERO_ADDRESS
        });

        expect(event.args.value).to.be.bignumber.equal(new BN(500).mul(INITIAL_STAKE_MULTIPLE));
      });
    });
  });

  describe('locked', function () {
    beforeEach(async function () {
      await this.bonding.mintToE(userAddress, 1000);
      await this.dollar.approve(this.bonding.address, 1000, {from: userAddress});

      await this.bonding.createCandidateE(ownerAddress, 7);
      await this.bonding.placeLockE(userAddress, ownerAddress);
    });

    it('is locked', async function () {
      expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(LOCKED);
    });

    describe('when deposit', function () {
      beforeEach(async function () {
        this.result = await this.bonding.deposit(1000, {from: userAddress});
      });

      it('doesnt revert', async function () {
        expect(this.result.tx).to.not.be.empty;
      });
    });

    describe('when withdraw', function () {
      beforeEach(async function () {
        await this.bonding.deposit(1000, {from: userAddress});
        this.result = await this.bonding.withdraw(1000, {from: userAddress});
      });

      it('doesnt revert', async function () {
        expect(this.result.tx).to.be.not.empty;
      });
    });

    describe('when bond', function () {
      it('reverts', async function () {
        await expectRevert(this.bonding.bond(1000, {from: userAddress}), "Permission: Not frozen");
      });
    });

    describe('when unbond', function () {
      it('reverts', async function () {
        await expectRevert(this.bonding.unbond(1000, {from: userAddress}), "Permission: Not frozen");
      });
    });
  });

  describe('when step', function () {
    beforeEach(async function () {
      /* Deposit and Bond User */
      await this.bonding.mintToE(userAddress, 1000);
      await this.dollar.approve(this.bonding.address, 1000, {from: userAddress});
      await this.bonding.deposit(1000, {from: userAddress});
      await this.bonding.bond(1000, {from: userAddress});

      await time.increase(86400);
      await this.bonding.stepE({from: userAddress});

      /* Payout to Bonded */
      await this.bonding.mintToE(this.bonding.address, 1000);
      await this.bonding.incrementTotalBondedE(1000);

      /* Deposit and Bond User 1+2 */
      await this.bonding.mintToE(userAddress1, 1000);
      await this.dollar.approve(this.bonding.address, 1000, {from: userAddress1});
      await this.bonding.deposit(1000, {from: userAddress1});

      await this.bonding.mintToE(userAddress2, 1000);
      await this.dollar.approve(this.bonding.address, 1000, {from: userAddress2});
      await this.bonding.deposit(1000, {from: userAddress2});

      await this.bonding.bond(1000, {from: userAddress1});
      await this.bonding.bond(1000, {from: userAddress2});

      await time.increase(86400);
      await this.bonding.stepE({from: userAddress});

      /* Unbond User */
      await this.bonding.unbondUnderlying(2000, {from: userAddress});

      await time.increase(86400);
      await this.bonding.stepE({from: userAddress});
    });

    it('user is frozen', async function () {
      expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(FROZEN);
    });

    it('is correct epoch', async function () {
      expect(await this.bonding.epoch()).to.be.bignumber.equal(new BN(4));
    });

    it('has correct snapshots', async function () {
      expect(await this.bonding.totalBondedAt(0)).to.be.bignumber.equal(new BN(0));
      expect(await this.bonding.totalBondedAt(1)).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
      expect(await this.bonding.totalBondedAt(2)).to.be.bignumber.equal(new BN(2000).mul(INITIAL_STAKE_MULTIPLE));
      expect(await this.bonding.totalBondedAt(3)).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
    });
  });
});