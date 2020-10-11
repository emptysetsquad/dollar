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
      await this.comptroller.decreaseDebtE(debt);
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

        it('updates total debt', async function () {
          expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(new BN(100));
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

        it('updates total debt', async function () {
          expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(new BN(300));
        });
      });
    });
  });

  describe('burnFromAccount', function () {
    beforeEach(async function () {
      await this.comptroller.mintToAccountE(circulating, new BN(10000));
      const debt = await this.comptroller.totalDebt();
      await this.comptroller.decreaseDebtE(debt);

      await this.comptroller.mintToE(userAddress, new BN(1000));
      await this.comptroller.increaseDebtE(new BN(1000));
      await this.dollar.approve(this.comptroller.address, new BN(1000), {from: userAddress});
    });

    describe('on single call', function () {
      beforeEach(async function () {
        await this.comptroller.burnFromAccountE(userAddress, new BN(100));
      });

      it('destroys Dollar tokens', async function () {
        expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(10900));
        expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(900));
      });

      it('updates total debt', async function () {
        expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(new BN(900));
      });
    });

    describe('multiple calls', function () {
      beforeEach(async function () {
        await this.comptroller.burnFromAccountE(userAddress, new BN(100));
        await this.comptroller.burnFromAccountE(userAddress, new BN(200));
      });

      it('destroys Dollar tokens', async function () {
        expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(10700));
        expect(await this.dollar.balanceOf(this.comptroller.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(700));
      });

      it('updates total debt', async function () {
        expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(new BN(700));
      });
    });

    describe('call when not enough debt', function () {
      beforeEach(async function () {
        await this.comptroller.decreaseDebtE(new BN(900));
      });

      it('reverts', async function () {
        await expectRevert(this.comptroller.burnFromAccountE(userAddress, new BN(200)), "not enough outstanding debt");
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
        await this.comptroller.redeemToAccountE(userAddress, new BN(100));
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
        await this.comptroller.redeemToAccountE(userAddress, new BN(100));
        await this.comptroller.redeemToAccountE(userAddress, new BN(200));
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
        await expectRevert(this.comptroller.redeemToAccountE(userAddress, new BN(400)), "not enough redeemable");
      });
    });
  });

  describe('increaseDebt', function () {
    beforeEach(async function () {
      await this.comptroller.mintToE(userAddress, new BN(1000));
    });

    describe('on single call', function () {
      beforeEach(async function () {
        await this.comptroller.increaseDebtE(new BN(100));
      });

      it('updates total debt', async function () {
        expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(new BN(100));
      });
    });

    describe('multiple calls', function () {
      beforeEach(async function () {
        await this.comptroller.increaseDebtE(new BN(100));
        await this.comptroller.increaseDebtE(new BN(200));
      });

      it('updates total debt', async function () {
        expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(new BN(300));
      });
    });

    describe('increase past supply', function () {
      beforeEach(async function () {
        await this.comptroller.increaseDebtE(new BN(100));
        await this.comptroller.increaseDebtE(new BN(300));
      });

      it('updates total debt', async function () {
        expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(new BN(350));
      });
    });

    describe('increase past supply', function () {
      beforeEach(async function () {
        await this.comptroller.increaseDebtE(new BN(100));
        await this.comptroller.increaseDebtE(new BN(1000));
      });

      it('updates total debt', async function () {
        expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(new BN(350));
      });
    });
  });

  describe('decreaseDebt', function () {
    beforeEach(async function () {
      await this.comptroller.mintToE(userAddress, new BN(1000));
      await this.comptroller.increaseDebtE(new BN(350))
    });

    describe('on single call', function () {
      beforeEach(async function () {
        await this.comptroller.decreaseDebtE(new BN(100));
      });

      it('updates total debt', async function () {
        expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(new BN(250));
      });
    });

    describe('multiple calls', function () {
      beforeEach(async function () {
        await this.comptroller.decreaseDebtE(new BN(100));
        await this.comptroller.decreaseDebtE(new BN(200));
      });

      it('updates total debt', async function () {
        expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(new BN(50));
      });
    });

    describe('decrease past supply', function () {
      it('reverts', async function () {
        await expectRevert(this.comptroller.decreaseDebtE(new BN(400)), "not enough debt");
      });
    });
  });

  describe('resetDebt', function () {
    beforeEach(async function () {
      await this.comptroller.mintToE(this.comptroller.address, new BN(10000));
      const debt = await this.comptroller.totalDebt();
      await this.comptroller.decrementTotalDebtE(debt, "");
      await this.comptroller.incrementTotalBondedE(new BN(10000));
    });

    describe('excess debt', function () {
      beforeEach(async function () {
        await this.comptroller.increaseDebtE(new BN(5000));
        await this.comptroller.resetDebtE(new BN(30));
      });

      it('decreases debt', async function () {
        expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(10000));
        expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(new BN(3000));
      });
    });

    describe('equal debt', function () {
      beforeEach(async function () {
        await this.comptroller.increaseDebtE(new BN(3000));
        await this.comptroller.resetDebtE(new BN(30));
      });

      it('debt unchanged', async function () {
        expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(10000));
        expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(new BN(3000));
      });
    });

    describe('less debt', function () {
      beforeEach(async function () {
        await this.comptroller.increaseDebtE(new BN(1000));
        await this.comptroller.resetDebtE(new BN(30));
      });

      it('debt unchanged', async function () {
        expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(10000));
        expect(await this.comptroller.totalDebt()).to.be.bignumber.equal(new BN(1000));
      });
    });
  });
});