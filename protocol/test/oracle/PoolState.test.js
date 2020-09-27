const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockPoolState = contract.fromArtifact('MockPoolState');
const MockSettableDAO = contract.fromArtifact('MockSettableDAO');
const MockToken = contract.fromArtifact('MockToken');

describe('PollState', function () {
  const [ ownerAddress, userAddress, userAddress2] = accounts;

  beforeEach(async function () {
    this.dao = await MockSettableDAO.new({from: ownerAddress});
    this.dollar = await MockToken.new("Empty Set Dollar", "ESD", 18, {from: ownerAddress});
    this.setters = await MockPoolState.new({from: ownerAddress});
    await this.setters.set(this.dao.address, this.dollar.address);
  });

  /**
   * Account
   */

  describe('incrementBalanceOfBonded', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.setters.incrementBalanceOfBondedE(userAddress, 100);
        await this.setters.incrementBalanceOfBondedE(userAddress, 100);
      });

      it('increments balance of phantom for user', async function () {
        expect(await this.setters.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(200));
      });

      it('increments total phantom', async function () {
        expect(await this.setters.totalBonded()).to.be.bignumber.equal(new BN(200));
      });
    });
  });

  describe('decrementBalanceOfBonded', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.setters.incrementBalanceOfBondedE(userAddress, 500);
        await this.setters.decrementBalanceOfBondedE(userAddress, 100, "decrementBalanceOfBondedE - 1");
        await this.setters.decrementBalanceOfBondedE(userAddress, 100, "decrementBalanceOfBondedE - 2");
      });

      it('decrements balance of phantom for user', async function () {
        expect(await this.setters.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(300));
      });

      it('decrements total phantom', async function () {
        expect(await this.setters.totalBonded()).to.be.bignumber.equal(new BN(300));
      });
    });

    describe('when called erroneously', function () {
      beforeEach('call', async function () {
        await this.setters.incrementBalanceOfBondedE(userAddress, 100);
      });

      it('reverts', async function () {
        await expectRevert(
          this.setters.decrementBalanceOfBondedE(200, "decrementBalanceOfBondedE"),
          "decrementBalanceOfBondedE");
      });
    });
  });

  describe('incrementBalanceOfStaged', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.setters.incrementBalanceOfStagedE(userAddress, 100);
        await this.setters.incrementBalanceOfStagedE(userAddress, 100);
      });

      it('increments balance of staged for user', async function () {
        expect(await this.setters.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(200));
      });

      it('increments total staged', async function () {
        expect(await this.setters.totalStaged()).to.be.bignumber.equal(new BN(200));
      });
    });
  });

  describe('decrementBalanceOfStaged', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.setters.incrementBalanceOfStagedE(userAddress, 500);
        await this.setters.decrementBalanceOfStagedE(userAddress, 100, "decrementBalanceOfStagedE - 1");
        await this.setters.decrementBalanceOfStagedE(userAddress, 100, "decrementBalanceOfStagedE - 2");
      });

      it('decrements balance of staged for user', async function () {
        expect(await this.setters.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(300));
      });

      it('decrements total staged', async function () {
        expect(await this.setters.totalStaged()).to.be.bignumber.equal(new BN(300));
      });
    });

    describe('when called erroneously', function () {
      beforeEach('call', async function () {
        await this.setters.incrementBalanceOfStagedE(userAddress, 100);
      });

      it('reverts', async function () {
        await expectRevert(
          this.setters.decrementBalanceOfStagedE(200, "decrementBalanceOfStagedE"),
          "decrementBalanceOfStagedE");
      });
    });
  });

  describe('incrementBalanceOfClaimable', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.setters.incrementBalanceOfClaimableE(userAddress, 100);
        await this.setters.incrementBalanceOfClaimableE(userAddress, 100);
      });

      it('increments balance of claimable for user', async function () {
        expect(await this.setters.balanceOfClaimable(userAddress)).to.be.bignumber.equal(new BN(200));
      });

      it('increments total claimable', async function () {
        expect(await this.setters.totalClaimable()).to.be.bignumber.equal(new BN(200));
      });
    });
  });

  describe('decrementBalanceOfClaimable', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.setters.incrementBalanceOfClaimableE(userAddress, 500);
        await this.setters.decrementBalanceOfClaimableE(userAddress, 100, "decrementBalanceOfClaimableE - 1");
        await this.setters.decrementBalanceOfClaimableE(userAddress, 100, "decrementBalanceOfClaimableE - 2");
      });

      it('decrements balance of claimable for user', async function () {
        expect(await this.setters.balanceOfClaimable(userAddress)).to.be.bignumber.equal(new BN(300));
      });

      it('decrements total claimable', async function () {
        expect(await this.setters.totalClaimable()).to.be.bignumber.equal(new BN(300));
      });
    });

    describe('when called erroneously', function () {
      beforeEach('call', async function () {
        await this.setters.incrementBalanceOfClaimableE(userAddress, 100);
      });

      it('reverts', async function () {
        await expectRevert(
          this.setters.decrementBalanceOfClaimableE(200, "decrementBalanceOfClaimableE"),
          "decrementBalanceOfClaimableE");
      });
    });
  });
  
  describe('incrementBalanceOfPhantom', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.setters.incrementBalanceOfPhantomE(userAddress, 100);
        await this.setters.incrementBalanceOfPhantomE(userAddress, 100);
      });

      it('increments balance of phantom for user', async function () {
        expect(await this.setters.balanceOfPhantom(userAddress)).to.be.bignumber.equal(new BN(200));
      });

      it('increments total phantom', async function () {
        expect(await this.setters.totalPhantom()).to.be.bignumber.equal(new BN(200));
      });
    });
  });

  describe('decrementBalanceOfPhantom', function () {
    describe('when called', function () {
      beforeEach('call', async function () {
        await this.setters.incrementBalanceOfPhantomE(userAddress, 500);
        await this.setters.decrementBalanceOfPhantomE(userAddress, 100, "decrementBalanceOfPhantomE - 1");
        await this.setters.decrementBalanceOfPhantomE(userAddress, 100, "decrementBalanceOfPhantomE - 2");
      });

      it('decrements balance of phantom for user', async function () {
        expect(await this.setters.balanceOfPhantom(userAddress)).to.be.bignumber.equal(new BN(300));
      });

      it('decrements total phantom', async function () {
        expect(await this.setters.totalPhantom()).to.be.bignumber.equal(new BN(300));
      });
    });

    describe('when called erroneously', function () {
      beforeEach('call', async function () {
        await this.setters.incrementBalanceOfPhantomE(userAddress, 100);
      });

      it('reverts', async function () {
        await expectRevert(
          this.setters.decrementBalanceOfPhantomE(200, "decrementBalanceOfPhantomE"),
          "decrementBalanceOfPhantomE");
      });
    });
  });

  describe('unfreeze', function () {
    describe('before called', function () {
      it('is frozen', async function () {
        expect(await this.setters.statusOf(userAddress)).to.be.bignumber.equal(new BN(0));
      });
    });

    describe('when called', function () {
      beforeEach('call', async function () {
        await this.setters.unfreezeE(userAddress);
      });

      it('is fluid', async function () {
        expect(await this.setters.statusOf(userAddress)).to.be.bignumber.equal(new BN(1));
      });
    });

    describe('when called then advanced', function () {
      beforeEach('call', async function () {
        await this.setters.unfreezeE(userAddress);
        await this.dao.set(1);
      });

      it('is frozen', async function () {
        expect(await this.setters.statusOf(userAddress)).to.be.bignumber.equal(new BN(0));
      });
    });
  });

  describe('rewarded', function () {
    describe('no user', function () {
      beforeEach('call', async function () {
        await this.dollar.mint(this.setters.address, 500);
      });

      it('reward display correctly', async function () {
        expect(await this.setters.balanceOfRewarded(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.setters.totalRewarded()).to.be.bignumber.equal(new BN(500));
      });
    });

    describe('single user', function () {
      beforeEach('call', async function () {
        await this.setters.incrementBalanceOfBondedE(userAddress, 100);
      });

      describe('when called', function () {
        beforeEach('call', async function () {
          await this.dollar.mint(this.setters.address, 500);
        });

        it('reward display correctly', async function () {
          expect(await this.setters.balanceOfRewarded(userAddress)).to.be.bignumber.equal(new BN(500));
          expect(await this.setters.totalRewarded()).to.be.bignumber.equal(new BN(500));
        });
      });
    });

    describe('multiple user', function () {
      beforeEach('call', async function () {
        await this.setters.incrementBalanceOfBondedE(userAddress, 100);
        await this.setters.incrementBalanceOfBondedE(userAddress2, 300);
      });

      describe('when called', function () {
        beforeEach('call', async function () {
          await this.dollar.mint(this.setters.address, 500);
        });

        it('reward display correctly', async function () {
          expect(await this.setters.balanceOfRewarded(userAddress)).to.be.bignumber.equal(new BN(125));
          expect(await this.setters.balanceOfRewarded(userAddress2)).to.be.bignumber.equal(new BN(375));
          expect(await this.setters.totalRewarded()).to.be.bignumber.equal(new BN(500));
        });
      });
    });
  });
});