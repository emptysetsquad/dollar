const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockComptroller = contract.fromArtifact('MockComptroller');
const Dollar = contract.fromArtifact('Dollar');

const BOOTSTRAPPING_PERIOD = 90;

describe('Comptroller', function () {
  const [ ownerAddress, userAddress, poolAddress, circulating ] = accounts;

  beforeEach(async function () {
    this.comptroller = await MockComptroller.new(poolAddress, {from: ownerAddress, gas: 8000000});
    this.dollar = await Dollar.at(await this.comptroller.dollar());
  });

  describe('mintToAccount', function () {
    beforeEach(async function () {
      await this.comptroller.mintToAccountE(circulating, new BN(10000));
      const debt = await this.comptroller.totalDebt();
    });

    describe('bootstrapping', function () {
      describe('on single call', function () {
        beforeEach(async function () {
          await this.comptroller.mintToAccountE(userAddress, new BN(100));
        });

        it('mints new Dollar tokens', async function () {
          expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(10100));
          expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(100));
        });

        it('doesnt update total debt', async function () {
          expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(new BN(0));
        });
      });

      describe('multiple calls', function () {
        beforeEach(async function () {
          await this.comptroller.mintToAccountE(userAddress, new BN(100));
          await this.comptroller.mintToAccountE(userAddress, new BN(200));
        });

        it('mints new Dollar tokens', async function () {
          expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(10300));
          expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(300));
        });

        it('doesnt update total debt', async function () {
          expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(new BN(0));
        });
      });
    });

    describe('bootstrapped', function () {
      this.timeout(30000);

      beforeEach(async function () {
        for (let i = 0; i < BOOTSTRAPPING_PERIOD + 1; i++) {
          await this.comptroller.incrementEpochE();
        }
      });

      describe('on single call', function () {
        beforeEach(async function () {
          await this.comptroller.mintToAccountE(userAddress, new BN(100));
        });

        it('mints new Dollar tokens', async function () {
          expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(10100));
          expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(100));
        });
      });

      describe('multiple calls', function () {
        beforeEach(async function () {
          await this.comptroller.mintToAccountE(userAddress, new BN(100));
          await this.comptroller.mintToAccountE(userAddress, new BN(200));
        });

        it('mints new Dollar tokens', async function () {
          expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(10300));
          expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(300));
        });
      });
    });
  });

  describe('redeemToAccount', function () {
    beforeEach(async function () {
      await this.comptroller.mintToE(this.comptroller.address, new BN(300));
      await this.comptroller.incrementTotalRedeemableE(new BN(300));
    });

    describe('on single call', function () {
      beforeEach(async function () {
        await this.comptroller.redeemToAccountE(userAddress, new BN(0), new BN(100));
      });

      it('doesnt mint new Dollar tokens', async function () {
        expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(300));
        expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(200));
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(100));
      });

      it('updates total redeemable', async function () {
        expect(await this.comptroller.totalRedeemable()).to.be.bignumber.equal(new BN(200));
      });
    });

    describe('multiple calls', function () {
      beforeEach(async function () {
        await this.comptroller.redeemToAccountE(userAddress, new BN(0), new BN(100));
        await this.comptroller.redeemToAccountE(userAddress, new BN(0), new BN(200));
      });

      it('doesnt mint new Dollar tokens', async function () {
        expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(300));
        expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(300));
      });

      it('updates total redeemable', async function () {
        expect(await this.comptroller.totalRedeemable()).to.be.bignumber.equal(new BN(0));
      });
    });

    describe('call when not enough redeemable', function () {
      beforeEach(async function () {
        await this.comptroller.incrementTotalBondedE(new BN(100));
        await this.comptroller.mintToE(this.comptroller.address, new BN(100));

        await this.comptroller.mintToE(this.comptroller.address, new BN(100));
        await this.comptroller.incrementTotalBondedE(new BN(100));
      });

      it('reverts', async function () {
        await expectRevert(this.comptroller.redeemToAccountE(userAddress, new BN(0), new BN(400)), "not enough redeemable");
      });
    });

    describe('with base amount', function () {
      beforeEach(async function () {
        await this.comptroller.redeemToAccountE(userAddress, new BN(1000), new BN(100));
      });

      it('doesnt mint new Dollar tokens', async function () {
        expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1300));
        expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(200));
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(1100));
      });

      it('updates total redeemable', async function () {
        expect(await this.comptroller.totalRedeemable()).to.be.bignumber.equal(new BN(200));
      });
    });

    describe('only base amount', function () {
      beforeEach(async function () {
        await this.comptroller.redeemToAccountE(userAddress, new BN(1000), new BN(0));
      });

      it('doesnt mint new Dollar tokens', async function () {
        expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1300));
        expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(300));
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(1000));
      });

      it('updates total redeemable', async function () {
        expect(await this.comptroller.totalRedeemable()).to.be.bignumber.equal(new BN(300));
      });
    });
  });
});
