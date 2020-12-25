const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const Dollar = contract.fromArtifact('Dollar');
const MockSettableDAO = contract.fromArtifact('MockSettableDAO');
const MockReserveComptroller = contract.fromArtifact('MockReserveComptroller');
const MockComptroller = contract.fromArtifact('MockComptroller');

const ONE_BIP = new BN(10).pow(new BN(14));

describe('ReserveComptroller', function () {
  const [ ownerAddress, daoAddress, userAddress, poolAddress ] = accounts;

  beforeEach(async function () {
    this.dollar = await Dollar.new({from: ownerAddress});
    this.dao = await MockSettableDAO.new({from: ownerAddress});
    this.comptroller = await MockComptroller.new(poolAddress, {from: ownerAddress});
    this.reserve = await MockReserveComptroller.new(this.dao.address, this.dollar.address, {from: ownerAddress});
    this.reserveCallable = await MockReserveComptroller.new(daoAddress, this.dollar.address, {from: ownerAddress});
    this.dollarComptroller = await Dollar.at(await this.comptroller.dollar());
    this.reserveComptroller = await MockReserveComptroller.new(this.comptroller.address, this.dollarComptroller.address, {from: ownerAddress});
    await this.comptroller.setReserve(this.reserveComptroller.address);
  });

  describe('setMintRateCap', function () {
    describe('basic set', function () {
      beforeEach(async function () {
        this.result = await this.reserveCallable.setMintRateCap(1000, {from: daoAddress});
        this.txHash = this.result.tx;
      });

      it('updates mint rate cap', async function () {
        expect(await this.reserveCallable.mintRateCap()).to.be.bignumber.equal(new BN(1000));
      });

      it('emits MintRateCapUpdate event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveComptroller, 'MintRateCapUpdate', {});

        expect(event.args.newMintRateCap).to.be.bignumber.equal(new BN(1000));
      });
    });

    describe('not dao', function () {
      it('reverts', async function () {
        await expectRevert(this.reserveCallable.setMintRateCap(1000, {from: userAddress}), "ReserveComptroller: not dao");
      });
    });

    describe('above hard limit', function () {
      it('reverts', async function () {
        await expectRevert(this.reserveCallable.setMintRateCap(new BN(350).mul(new BN(10).pow(new BN(16))), {from: daoAddress}), "ReserveComptroller: rate too high");
      });
    });
  });

  describe('setBurnRateCap', function () {
    describe('basic set', function () {
      beforeEach(async function () {
        this.result = await this.reserveCallable.setBurnRateCap(1000, {from: daoAddress});
        this.txHash = this.result.tx;
      });

      it('updates burn rate cap', async function () {
        expect(await this.reserveCallable.burnRateCap()).to.be.bignumber.equal(new BN(1000));
      });

      it('emits BurnRateCapUpdate event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockReserveComptroller, 'BurnRateCapUpdate', {});

        expect(event.args.newBurnRateCap).to.be.bignumber.equal(new BN(1000));
      });
    });

    describe('not dao', function () {
      it('reverts', async function () {
        await expectRevert(this.reserveCallable.setBurnRateCap(1000, {from: userAddress}), "ReserveComptroller: not dao");
      });
    });

    describe('above hard limit', function () {
      it('reverts', async function () {
        await expectRevert(this.reserveCallable.setBurnRateCap(new BN(350).mul(ONE_BIP), {from: daoAddress}), "ReserveComptroller: rate too high");
      });
    });
  });

  describe('withdraw', function () {
    beforeEach(async function () {
      await this.dollar.mint(this.reserveCallable.address, 1000, {from: ownerAddress})
    });

    it('transfers tokens', async function () {
      expect(await this.dollar.balanceOf(this.reserveCallable.address)).to.be.bignumber.equal(new BN(1000));
      expect(await this.dollar.balanceOf(daoAddress)).to.be.bignumber.equal(new BN(0));
    });

    describe('from dao', function () {
      beforeEach(async function () {
        this.result = await this.reserveCallable.withdraw(this.dollar.address, 1000, {from: daoAddress});
      });

      it('transfers tokens', async function () {
        expect(await this.dollar.balanceOf(this.reserveCallable.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.dollar.balanceOf(daoAddress)).to.be.bignumber.equal(new BN(1000));
      });
    });

    describe('not dao', function () {
      it('reverts', async function () {
        await expectRevert(this.reserveCallable.withdraw(this.dollar.address, 1000, {from: userAddress}), "ReserveComptroller: not dao");
      });
    });
  });

  describe('recordTotalSupplyE', function () {
    beforeEach(async function () {
      await this.dao.set(1);
      await this.dollar.mint(this.reserve.address, 1000000, {from: ownerAddress})
    });

    describe('before call', function () {
      it('records', async function () {
        expect(await this.reserve.totalSupplyAt(1)).to.be.bignumber.equal(new BN(0));
        expect(await this.reserve.getLastEpochResult()).to.be.bignumber.equal(new BN(0));
      });
    });

    describe('call once', function () {
      beforeEach(async function () {
        await this.reserve.recordTotalSupplyE();
      });

      it('records', async function () {
        expect(await this.reserve.totalSupplyAt(1)).to.be.bignumber.equal(new BN(1000000));
        expect(await this.reserve.getLastEpochResult()).to.be.bignumber.equal(new BN(1));
      });
    });

    describe('call twice same epoch', function () {
      beforeEach(async function () {
        await this.reserve.recordTotalSupplyE();
        await this.dollar.mint(this.reserve.address, 1000000, {from: ownerAddress})
        await this.reserve.recordTotalSupplyE();
      });

      it('records', async function () {
        expect(await this.reserve.totalSupplyAt(1)).to.be.bignumber.equal(new BN(1000000));
        expect(await this.reserve.getLastEpochResult()).to.be.bignumber.equal(new BN(1));
      });
    });

    describe('call twice next epoch', function () {
      beforeEach(async function () {
        await this.reserve.recordTotalSupplyE();
        await this.dollar.mint(this.reserve.address, 1000000, {from: ownerAddress});
        await this.dao.set(2);
        await this.reserve.recordTotalSupplyE();
      });

      it('records', async function () {
        expect(await this.reserve.totalSupplyAt(1)).to.be.bignumber.equal(new BN(1000000));
        expect(await this.reserve.totalSupplyAt(2)).to.be.bignumber.equal(new BN(2000000));
        expect(await this.reserve.getLastEpochResult()).to.be.bignumber.equal(new BN(2));
      });
    });
  });

  describe('mintWithCapE', function () {
    beforeEach(async function () {
      await this.comptroller.incrementEpochE();
      await this.comptroller.mintToAccountE(this.comptroller.address, 1000000, {from: ownerAddress});
    });

    describe('call once', function () {
      beforeEach(async function () {
        await this.comptroller.setReserveParams(new BN(100).mul(ONE_BIP), new BN(0));
        await this.reserveComptroller.mintWithCapE(1000);
      });

      it('mints', async function () {
        expect(await this.dollarComptroller.balanceOf(this.reserveComptroller.address)).to.be.bignumber.equal(new BN(1000));
        expect(await this.dollarComptroller.totalSupply()).to.be.bignumber.equal(new BN(1001000));
        expect(await this.reserveComptroller.mintable(1)).to.be.bignumber.equal(new BN(9000));
      });
    });

    describe('call multiple', function () {
      beforeEach(async function () {
        await this.comptroller.setReserveParams(new BN(100).mul(ONE_BIP), new BN(0));
        await this.reserveComptroller.mintWithCapE(1000);
        await this.reserveComptroller.mintWithCapE(1000);
      });

      it('mints', async function () {
        expect(await this.dollarComptroller.balanceOf(this.reserveComptroller.address)).to.be.bignumber.equal(new BN(2000));
        expect(await this.dollarComptroller.totalSupply()).to.be.bignumber.equal(new BN(1002000));
        expect(await this.reserveComptroller.mintable(1)).to.be.bignumber.equal(new BN(8000));
      });
    });

    describe('call zero', function () {
      beforeEach(async function () {
        await this.comptroller.setReserveParams(new BN(100).mul(ONE_BIP), new BN(0));
        await this.reserveComptroller.mintWithCapE(0);
      });

      it('mints', async function () {
        expect(await this.dollarComptroller.balanceOf(this.reserveComptroller.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.dollarComptroller.totalSupply()).to.be.bignumber.equal(new BN(1000000));
        expect(await this.reserveComptroller.mintable(1)).to.be.bignumber.equal(new BN(10000));
      });
    });

    describe('call over limit single', function () {
      beforeEach(async function () {
        await this.comptroller.setReserveParams(new BN(100).mul(ONE_BIP), new BN(0));
      });

      it('reverts', async function () {
        await expectRevert(this.reserveComptroller.mintWithCapE(11000), "ReserveComptroller: not enough mintable");
      });
    });

    describe('call over limit aggregate', function () {
      beforeEach(async function () {
        await this.comptroller.setReserveParams(new BN(100).mul(ONE_BIP), new BN(0));
        await this.reserveComptroller.mintWithCapE(6000)
      });

      it('reverts', async function () {
        await expectRevert(this.reserveComptroller.mintWithCapE(5000), "ReserveComptroller: not enough mintable");
      });
    });

    describe('call over limit aggregate across epoch', function () {
      beforeEach(async function () {
        await this.comptroller.setReserveParams(new BN(100).mul(ONE_BIP), new BN(0));
        await this.reserveComptroller.mintWithCapE(6000);
        await this.comptroller.incrementEpochE();
        await this.reserveComptroller.mintWithCapE(5000);
      });

      it('mints', async function () {
        expect(await this.dollarComptroller.balanceOf(this.reserveComptroller.address)).to.be.bignumber.equal(new BN(11000));
        expect(await this.dollarComptroller.totalSupply()).to.be.bignumber.equal(new BN(1011000));
        expect(await this.reserveComptroller.mintable(2)).to.be.bignumber.equal(new BN(5060));
      });
    });
  });

  describe('burnWithCapE', function () {
    beforeEach(async function () {
      await this.comptroller.incrementEpochE();
      await this.comptroller.mintToAccountE(this.reserveComptroller.address, 1000000, {from: ownerAddress});
    });

    describe('call once', function () {
      beforeEach(async function () {
        await this.comptroller.setReserveParams(new BN(0), new BN(100).mul(ONE_BIP));
        await this.reserveComptroller.burnWithCapE(1000);
      });

      it('burns', async function () {
        expect(await this.dollarComptroller.balanceOf(this.reserveComptroller.address)).to.be.bignumber.equal(new BN(999000));
        expect(await this.dollarComptroller.totalSupply()).to.be.bignumber.equal(new BN(999000));
        expect(await this.reserveComptroller.burnable(1)).to.be.bignumber.equal(new BN(9000));
      });
    });

    describe('call multiple', function () {
      beforeEach(async function () {
        await this.comptroller.setReserveParams(new BN(0), new BN(100).mul(ONE_BIP));
        await this.reserveComptroller.burnWithCapE(1000);
        await this.reserveComptroller.burnWithCapE(1000);
      });

      it('burns', async function () {
        expect(await this.dollarComptroller.balanceOf(this.reserveComptroller.address)).to.be.bignumber.equal(new BN(998000));
        expect(await this.dollarComptroller.totalSupply()).to.be.bignumber.equal(new BN(998000));
        expect(await this.reserveComptroller.burnable(1)).to.be.bignumber.equal(new BN(8000));
      });
    });

    describe('call zero', function () {
      beforeEach(async function () {
        await this.comptroller.setReserveParams(new BN(0), new BN(100).mul(ONE_BIP));
        await this.reserveComptroller.burnWithCapE(0);
      });

      it('burns', async function () {
        expect(await this.dollarComptroller.balanceOf(this.reserveComptroller.address)).to.be.bignumber.equal(new BN(1000000));
        expect(await this.dollarComptroller.totalSupply()).to.be.bignumber.equal(new BN(1000000));
        expect(await this.reserveComptroller.burnable(1)).to.be.bignumber.equal(new BN(10000));
      });
    });

    describe('call over limit single', function () {
      beforeEach(async function () {
        await this.comptroller.setReserveParams(new BN(0), new BN(100).mul(ONE_BIP));
      });

      it('reverts', async function () {
        await expectRevert(this.reserveComptroller.burnWithCapE(11000), "ReserveComptroller: not enough burnable");
      });
    });

    describe('call over limit aggregate', function () {
      beforeEach(async function () {
        await this.comptroller.setReserveParams(new BN(0), new BN(100).mul(ONE_BIP));
        await this.reserveComptroller.burnWithCapE(6000)
      });

      it('reverts', async function () {
        await expectRevert(this.reserveComptroller.burnWithCapE(5000), "ReserveComptroller: not enough burnable");
      });
    });

    describe('call over limit aggregate across epoch', function () {
      beforeEach(async function () {
        await this.comptroller.setReserveParams(new BN(0), new BN(100).mul(ONE_BIP));
        await this.reserveComptroller.burnWithCapE(6000);
        await this.comptroller.incrementEpochE();
        await this.reserveComptroller.burnWithCapE(5000);
      });

      it('burns', async function () {
        expect(await this.dollarComptroller.balanceOf(this.reserveComptroller.address)).to.be.bignumber.equal(new BN(989000));
        expect(await this.dollarComptroller.totalSupply()).to.be.bignumber.equal(new BN(989000));
        expect(await this.reserveComptroller.burnable(2)).to.be.bignumber.equal(new BN(4940));
      });
    });
  });
});