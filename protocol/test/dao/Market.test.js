const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, expectEvent, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockMarket = contract.fromArtifact('MockMarket');
const Dollar = contract.fromArtifact('Dollar');

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAX_UINT256 = new BN(2).pow(new BN(256)).subn(1);
const DEBT_CAP = 0.15;

describe('Market', function () {
  const [ ownerAddress, userAddress, poolAddress ] = accounts;

  beforeEach(async function () {
    this.market = await MockMarket.new(poolAddress, {from: ownerAddress, gas: 8000000});
    this.dollar = await Dollar.at(await this.market.dollar());

    await this.market.incrementEpochE();
    await this.market.mintToE(userAddress, 1000000);
    await this.dollar.approve(this.market.address, 1000000, {from: userAddress});
  });

  describe('redeemCoupons', function () {
    beforeEach(async function () {
      this.couponUnderlying = 100000;
      this.couponAmount = 0;
      await this.market.incrementBalanceOfCouponUnderlyingE(userAddress, 1, 100000);
      await this.market.burnFromE(userAddress, 100000)
      await this.market.mintToE(this.market.address, 100000);
    });

    describe('before redeemable', function () {
      describe('same epoch', function () {
        it('reverts', async function () {
          await expectRevert(this.market.redeemCoupons(1, this.couponUnderlying, {from: userAddress}), "Market: Too early to redeem");
        });
      });

      describe('next epoch', function () {
        it('reverts', async function () {
          await this.market.incrementEpochE();
          await expectRevert(this.market.redeemCoupons(1, this.couponUnderlying, {from: userAddress}), "Market: Too early to redeem");
        });
      });
    });

    describe('redeem underlying', function () {
      this.timeout(30000);

      beforeEach(async function () {
        await this.market.mintToE(this.market.address, 100000);
        await this.market.incrementTotalBondedE(100000);

        for (let i = 0; i < 90; i++) {
          await this.market.incrementEpochE();
        }

        this.result = await this.market.redeemCoupons(1, this.couponUnderlying, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('updates user balances', async function () {
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(900000 + this.couponUnderlying));
        expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.equal(new BN(0));
        expect(await this.market.balanceOfCouponUnderlying(userAddress, 1)).to.be.bignumber.equal(new BN(0));
      });

      it('updates dao balances', async function () {
        let extraBalance = 100000 - this.couponAmount;
        let redeemableReturned = Math.floor(this.couponAmount * 0.775);
        expect(await this.dollar.balanceOf(this.market.address)).to.be.bignumber.closeTo(new BN(100000 + extraBalance + redeemableReturned), new BN(1));
        expect(await this.market.totalCoupons()).to.be.bignumber.equal(new BN(0));
        expect(await this.market.totalCouponUnderlying()).to.be.bignumber.equal(new BN(0));
        expect(await this.market.totalDebt()).to.be.bignumber.equal(new BN(0));
        expect(await this.market.totalRedeemable()).to.be.bignumber.equal(new BN(0));
      });

      it('emits CouponRedemption event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponRedemption', {
          account: userAddress,
        });

        expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
        expect(event.args.amount).to.be.bignumber.equal(new BN(this.couponUnderlying));
        expect(event.args.couponAmount).to.be.bignumber.equal(new BN(0));
      });
    });
  });

  describe('approveCoupons', function () {
    describe('zero address', function () {
      it('reverts', async function () {
        await expectRevert(this.market.approveCoupons(ZERO_ADDRESS, 1000, {from: userAddress}), "Market: Coupon approve to the zero address");
      });
    });

    describe('on single call', function () {
      beforeEach(async function () {
        this.result = await this.market.approveCoupons(ownerAddress, 100000, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('updates user approval', async function () {
        expect(await this.market.allowanceCoupons(userAddress, ownerAddress)).to.be.bignumber.equal(new BN(100000));
      });

      it('emits CouponApproval event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponApproval', {
          owner: userAddress,
          spender: ownerAddress,
        });

        expect(event.args.value).to.be.bignumber.equal(new BN(100000));
      });
    });

    describe('multiple calls', function () {
      beforeEach(async function () {
        await this.market.approveCoupons(ownerAddress, 100000, {from: userAddress});
        this.result = await this.market.approveCoupons(ownerAddress, 0, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('updates user approval', async function () {
        expect(await this.market.allowanceCoupons(userAddress, ownerAddress)).to.be.bignumber.equal(new BN(0));
      });

      it('emits CouponApproval event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponApproval', {
          owner: userAddress,
          spender: ownerAddress,
        });

        expect(event.args.value).to.be.bignumber.equal(new BN(0));
      });
    });
  });

  describe('transferCoupons', function () {
    beforeEach(async function () {
      await this.market.incrementBalanceOfCouponUnderlyingE(userAddress, 1, 100000);
      await this.market.burnFromE(userAddress, 100000)
    });

    describe('sender zero address', function () {
      it('reverts', async function () {
        await expectRevert(this.market.transferCoupons(ZERO_ADDRESS, userAddress, 1, 100000, {from: userAddress}), "Market: Coupon transfer from the zero address");
      });
    });

    describe('recipient zero address', function () {
      it('reverts', async function () {
        await expectRevert(this.market.transferCoupons(userAddress, ZERO_ADDRESS, 1, 100000, {from: userAddress}), "Market: Coupon transfer to the zero address");
      });
    });

    describe('on call from self', function () {
      beforeEach(async function () {
        this.result = await this.market.transferCoupons(userAddress, ownerAddress, 1, 50000, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('updates balances', async function () {
        expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.closeTo(new BN(0).divn(2), new BN(1));
        expect(await this.market.balanceOfCouponUnderlying(userAddress, 1)).to.be.bignumber.equal(new BN(50000));
        expect(await this.market.balanceOfCoupons(ownerAddress, 1)).to.be.bignumber.closeTo(new BN(0).divn(2), new BN(1));
        expect(await this.market.balanceOfCouponUnderlying(ownerAddress, 1)).to.be.bignumber.equal(new BN(50000));
      });

      it('emits CouponTransfer event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponTransfer', {
          from: userAddress,
          to: ownerAddress,
        });

        expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
        expect(event.args.value).to.be.bignumber.equal(new BN(50000));
      });
    });

    describe('on call from self too much', function () {
      it('reverts', async function () {
        await expectRevert(this.market.transferCoupons(userAddress, ownerAddress, 1, 200000, {from: ownerAddress}), "Market: Insufficient coupon underlying balance");
      });
    });

    describe('on unapproved call from other', function () {
      it('reverts', async function () {
        await expectRevert(this.market.transferCoupons(userAddress, ownerAddress, 1, 100000, {from: ownerAddress}), "Market: Insufficient coupon approval");
      });
    });

    describe('on approved call from other', function () {
      beforeEach(async function () {
        await this.market.approveCoupons(ownerAddress, 50000, {from: userAddress});
        this.result = await this.market.transferCoupons(userAddress, ownerAddress, 1, 50000, {from: ownerAddress});
        this.txHash = this.result.tx;
      });

      it('updates balances', async function () {
        expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.closeTo(new BN(0).divn(2), new BN(1));
        expect(await this.market.balanceOfCouponUnderlying(userAddress, 1)).to.be.bignumber.equal(new BN(50000));
        expect(await this.market.balanceOfCoupons(ownerAddress, 1)).to.be.bignumber.closeTo(new BN(0).divn(2), new BN(1));
        expect(await this.market.balanceOfCouponUnderlying(ownerAddress, 1)).to.be.bignumber.equal(new BN(50000));
      });

      it('updates approval', async function () {
        expect(await this.market.allowanceCoupons(userAddress, ownerAddress)).to.be.bignumber.equal(new BN(0));
      });

      it('emits CouponTransfer event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponTransfer', {
          from: userAddress,
          to: ownerAddress,
        });

        expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
        expect(event.args.value).to.be.bignumber.equal(new BN(50000));
      });
    });

    describe('infinite approval', function () {
      beforeEach(async function () {
        await this.market.approveCoupons(ownerAddress, MAX_UINT256, {from: userAddress});
        await this.market.transferCoupons(userAddress, ownerAddress, 1, 100000, {from: ownerAddress});
      });

      it('doesnt update approval', async function () {
        expect(await this.market.allowanceCoupons(userAddress, ownerAddress)).to.be.bignumber.equal(MAX_UINT256);
      });
    });
  });
});
