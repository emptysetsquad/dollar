const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, expectEvent, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockMarket = contract.fromArtifact('MockMarket');
const Dollar = contract.fromArtifact('Dollar');

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000";
const MAX_UINT256 = new BN(2).pow(new BN(256)).subn(1);
const DEBT_CAP = 0.15;

function premium(supply, debt, amount) {
  const start = debt / supply;
  const end = (debt - amount) / (supply - amount)

  if (start <= DEBT_CAP) {
    return Math.floor(premiumMean(start, end) * amount)
  }

  if (end >= DEBT_CAP) {
    return premiumSpot(DEBT_CAP);
  }

  const pCurve = Math.floor(premiumMean(start, DEBT_CAP)) * (start - DEBT_CAP);
  const pFlat = premiumSpot(DEBT_CAP) * (DEBT_CAP - end);
  return Math.floor((pCurve + pFlat) / (start - end) * amount);
}

function premiumSpot(ratio) {
  return 1.0 / ((1.0 - ratio) ^ 2) - 1.0
}

function premiumMean(start, end) {
  return 1.0 / ((1.0 - start) * (1.0 - end)) - 1.0
}

function prorated(coupons, epochs) {
  return Math.floor(coupons * epochs / 90);
}

describe('Market', function () {
  const [ ownerAddress, userAddress, poolAddress ] = accounts;

  beforeEach(async function () {
    this.market = await MockMarket.new(poolAddress, {from: ownerAddress, gas: 8000000});
    this.dollar = await Dollar.at(await this.market.dollar());

    await this.market.incrementEpochE();
    await this.market.stepE();
    await this.market.mintToE(userAddress, 1000000);
    await this.dollar.approve(this.market.address, 1000000, {from: userAddress});
  });

  describe('purchaseCoupons', function () {
    describe('before call', function () {
      beforeEach(async function () {
        await this.market.incrementTotalDebtE(100000);
      });

      it('shows correct potential coupon premium', async function () {
        expect(await this.market.couponPremium(100000)).to.be.bignumber.equal(new BN(premium(1000000, 100000, 100000)));
      });
    });

    describe('no amount', function () {
      it('reverts', async function () {
        await expectRevert(this.market.purchaseCoupons(0, {from: userAddress}), "Market: Must purchase non-zero amount");
      });
    });

    describe('no debt', function () {
      it('total net is correct', async function () {
        expect(await this.market.totalNet()).to.be.bignumber.equal(new BN(1000000));
      });

      it('reverts', async function () {
        await expectRevert(this.market.purchaseCoupons(100000), "Market: Not enough debt");
      });
    });

    describe('on single call', function () {
      beforeEach(async function () {
        await this.market.incrementTotalDebtE(100000);
        this.result = await this.market.purchaseCoupons(100000, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('updates user balances', async function () {
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(900000));
        expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.equal(new BN(premium(1000000, 100000, 100000)));
        expect(await this.market.balanceOfCouponUnderlying(userAddress, 1)).to.be.bignumber.equal(new BN(100000));
      });

      it('shows correct preimum', async function () {
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(900000));
        expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.equal(new BN(premium(1000000, 100000, 100000)));
        expect(await this.market.balanceOfCouponUnderlying(userAddress, 1)).to.be.bignumber.equal(new BN(100000));
      });

      it('updates dao balances', async function () {
        expect(await this.dollar.balanceOf(this.market.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.market.totalCoupons()).to.be.bignumber.equal(new BN(premium(1000000, 100000, 100000)));
        expect(await this.market.totalCouponUnderlying()).to.be.bignumber.equal(new BN(100000));
        expect(await this.market.totalDebt()).to.be.bignumber.equal(new BN(0));
        expect(await this.market.totalRedeemable()).to.be.bignumber.equal(new BN(0));
      });

      it('emits CouponPurchase event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponPurchase', {
          account: userAddress,
        });

        expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
        expect(event.args.dollarAmount).to.be.bignumber.equal(new BN(100000));
        expect(event.args.couponAmount).to.be.bignumber.equal(new BN(premium(1000000, 100000, 100000)));
      });
    });

    describe('multiple calls', function () {
      beforeEach(async function () {
        await this.market.incrementTotalDebtE(100000);
        await this.market.purchaseCoupons(50000, {from: userAddress});
        this.result = await this.market.purchaseCoupons(50000, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('updates user balances', async function () {
        expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(900000));
        expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.equal(new BN(premium(1000000, 100000, 50000) + premium(950000, 50000, 50000)));
        expect(await this.market.balanceOfCouponUnderlying(userAddress, 1)).to.be.bignumber.equal(new BN(100000));
      });

      it('updates dao balances', async function () {
        expect(await this.dollar.balanceOf(this.market.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.market.totalCoupons()).to.be.bignumber.equal(new BN(premium(1000000, 100000, 50000) + premium(950000, 50000, 50000)));
        expect(await this.market.totalCouponUnderlying()).to.be.bignumber.equal(new BN(100000));
        expect(await this.market.totalDebt()).to.be.bignumber.equal(new BN(0));
        expect(await this.market.totalRedeemable()).to.be.bignumber.equal(new BN(0));
      });

      it('emits CouponPurchase event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponPurchase', {
          account: userAddress,
        });

        expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
        expect(event.args.dollarAmount).to.be.bignumber.equal(new BN(50000));
        expect(event.args.couponAmount).to.be.bignumber.equal(new BN(premium(950000, 50000, 50000)));
      });
    });
  });

  describe('migrateCoupons', function () {
    beforeEach(async function () {
      await this.market.incrementBalanceOfCouponsE(userAddress, 1, 100000);
    });

    describe('before call', function () {
      it('updates user balances', async function () {
        expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.equal(new BN(100000));
        expect(await this.market.balanceOfCouponUnderlying(userAddress, 1)).to.be.bignumber.equal(new BN(0));
      });

      it('updates dao balances', async function () {
        expect(await this.market.totalCoupons()).to.be.bignumber.equal(new BN(100000));
        expect(await this.market.outstandingCoupons(1)).to.be.bignumber.equal(new BN(100000));
        expect(await this.market.totalCouponUnderlying()).to.be.bignumber.equal(new BN(0));
      });
    });

    describe('no coupons', function () {
      it('reverts', async function () {
        await expectRevert(this.market.migrateCoupons(0, {from: userAddress}), "Market: No coupons");
      });
    });

    describe('on single call', function () {
      beforeEach(async function () {
        this.result = await this.market.migrateCoupons(1, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('updates user balances', async function () {
        expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.equal(new BN(50000));
        expect(await this.market.balanceOfCouponUnderlying(userAddress, 1)).to.be.bignumber.equal(new BN(50000));
      });

      it('updates dao balances', async function () {
        expect(await this.market.totalCoupons()).to.be.bignumber.equal(new BN(50000));
        expect(await this.market.outstandingCoupons(1)).to.be.bignumber.equal(new BN(50000));
        expect(await this.market.totalCouponUnderlying()).to.be.bignumber.equal(new BN(50000));
      });

      it('emits CouponPurchase event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponPurchase', {
          account: userAddress,
        });

        expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
        expect(event.args.dollarAmount).to.be.bignumber.equal(new BN(50000));
        expect(event.args.couponAmount).to.be.bignumber.equal(new BN(0));
      });

      it('emits CouponRedemption event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponRedemption', {
          account: userAddress,
        });

        expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
        expect(event.args.amount).to.be.bignumber.equal(new BN(0));
        expect(event.args.couponAmount).to.be.bignumber.equal(new BN(50000));
      });
    });

    describe('call twice', function () {
      beforeEach(async function () {
        await this.market.migrateCoupons(1, {from: userAddress});
      });

      it('reverts', async function () {
        await expectRevert(this.market.migrateCoupons(1, {from: userAddress}), "Market: Already migrated");
      });
    });

    describe('after expired', function () {
      this.timeout(30000);

      beforeEach(async function () {
        for (let i = 0; i < 90; i++) {
          await this.market.incrementEpochE();
        }
        await this.market.stepE();
      });

      it('reverts', async function () {
        await expectRevert(this.market.migrateCoupons(1, {from: userAddress}), "Market: No coupons");
      });
    });
  });

  describe('redeemCoupons - legacy', function () {
    beforeEach(async function () {
      await this.market.set(500);

      await this.market.incrementTotalDebtE(100000);
      await this.market.purchaseCoupons(100000, {from: userAddress});
      await this.market.mintToE(this.market.address, 100000);

      this.couponUnderlying = 100000;
      this.couponAmount = premium(1000000, 100000, 100000);

      await this.market.incrementTotalRedeemableE(this.couponAmount);
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

    describe('after redeemable', function () {
      beforeEach(async function () {
        await this.market.incrementEpochE();
        await this.market.incrementEpochE();
      });

      describe('not enough coupon balance', function () {
        it('reverts', async function () {
          await expectRevert(this.market.redeemCoupons(1, this.couponUnderlying + 1, {from: userAddress}), "Market: Insufficient coupon underlying balance");
        });
      });

      describe('on single call', function () {
        beforeEach(async function () {
          this.result = await this.market.redeemCoupons(1, this.couponUnderlying, {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('updates user balances', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(900000 + this.couponUnderlying + this.couponAmount));
          expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.equal(new BN(0));
          expect(await this.market.balanceOfCouponUnderlying(userAddress, 1)).to.be.bignumber.equal(new BN(0));
        });

        it('updates dao balances', async function () {
          expect(await this.dollar.balanceOf(this.market.address)).to.be.bignumber.equal(new BN(100000 - this.couponAmount));
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
          expect(event.args.couponAmount).to.be.bignumber.equal(new BN(this.couponAmount));
        });
      });

      describe('multiple calls', function () {
        beforeEach(async function () {
          this.result = await this.market.redeemCoupons(1, 30000, {from: userAddress});
          this.result = await this.market.redeemCoupons(1, 50000, {from: userAddress});
          this.txHash = this.result.tx;
          this.redeemedAmount = (this.couponAmount) * 8 / 10;
          this.redeemedTotal = (this.couponUnderlying + this.couponAmount) * 8 / 10;
        });

        it('updates user balances', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(900000 + this.redeemedTotal));
          expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.closeTo(new BN(this.couponAmount - this.redeemedAmount), new BN(1));
        });

        it('updates dao balances', async function () {
          expect(await this.dollar.balanceOf(this.market.address)).to.be.bignumber.closeTo(new BN(100000 - this.redeemedAmount), new BN(1));
          expect(await this.market.totalCoupons()).to.be.bignumber.closeTo(new BN(this.couponAmount - this.redeemedAmount), new BN(1));
          expect(await this.market.totalDebt()).to.be.bignumber.equal(new BN(0));
          expect(await this.market.totalRedeemable()).to.be.bignumber.closeTo(new BN(this.couponAmount - this.redeemedAmount), new BN(1));
        });

        it('emits CouponRedemption event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponRedemption', {
            account: userAddress,
          });

          expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
          expect(event.args.amount).to.be.bignumber.equal(new BN(50000));
          expect(event.args.couponAmount).to.be.bignumber.equal(new BN(this.couponAmount / 2));
        });
      });
    });

    describe('after expired', function () {
      this.timeout(30000);

      beforeEach(async function () {
        await this.market.mintToE(this.market.address, 100000);
        await this.market.incrementTotalBondedE(100000);

        for (let i = 0; i < 90; i++) {
          await this.market.incrementEpochE();
        }
        await this.market.stepE();

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

  describe('redeemCoupons - prorated', function () {
    beforeEach(async function () {
      await this.market.incrementTotalDebtE(100000);
      await this.market.purchaseCoupons(100000, {from: userAddress});
      await this.market.mintToE(this.market.address, 100000);

      this.couponUnderlying = 100000;
      this.couponAmount = premium(1000000, 100000, 100000);

      const coupons = (await this.market.balanceOfCoupons(userAddress, 1)).toString();
      const underlying = (await this.market.balanceOfCouponUnderlying(userAddress, 1)).toString();

      await this.market.incrementTotalRedeemableE(this.couponAmount);
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

    describe('after redeemable', function () {
      beforeEach(async function () {
        await this.market.incrementEpochE();
        await this.market.incrementEpochE();
        await this.market.updateEraE(0); // expansion
      });

      describe('not enough coupon balance', function () {
        it('reverts', async function () {
          await expectRevert(this.market.redeemCoupons(1, this.couponUnderlying + 1, {from: userAddress}), "Market: Insufficient coupon underlying balance");
        });
      });

      describe('on single call', function () {
        beforeEach(async function () {
          this.result = await this.market.redeemCoupons(1, this.couponUnderlying, {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('updates user balances', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(900000 + this.couponUnderlying + prorated(this.couponAmount, 1)));
          expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.equal(new BN(0));
          expect(await this.market.balanceOfCouponUnderlying(userAddress, 1)).to.be.bignumber.equal(new BN(0));
        });

        it('updates dao balances', async function () {
          expect(await this.dollar.balanceOf(this.market.address)).to.be.bignumber.equal(new BN(100000 - prorated(this.couponAmount, 1)));
          expect(await this.market.totalCoupons()).to.be.bignumber.equal(new BN(0));
          expect(await this.market.totalCouponUnderlying()).to.be.bignumber.equal(new BN(0));
          expect(await this.market.totalDebt()).to.be.bignumber.equal(new BN(0));
          expect(await this.market.totalRedeemable()).to.be.bignumber.equal(new BN(this.couponAmount - prorated(this.couponAmount, 1)));
        });

        it('emits CouponRedemption event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponRedemption', {
            account: userAddress,
          });

          expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
          expect(event.args.amount).to.be.bignumber.equal(new BN(this.couponUnderlying));
          expect(event.args.couponAmount).to.be.bignumber.equal(new BN(this.couponAmount));
        });
      });

      describe('multiple calls', function () {
        beforeEach(async function () {
          this.result = await this.market.redeemCoupons(1, 30000, {from: userAddress});
          this.result = await this.market.redeemCoupons(1, 50000, {from: userAddress});
          this.txHash = this.result.tx;
          this.redeemedAmount = (this.couponAmount) * 8 / 10;
          this.redeemedTotal = (this.couponUnderlying + prorated(this.couponAmount, 1)) * 8 / 10;
        });

        it('updates user balances', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(900000 + this.redeemedTotal));
          expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.closeTo(new BN(this.couponAmount - this.redeemedAmount), new BN(1));
        });

        it('updates dao balances', async function () {
          expect(await this.dollar.balanceOf(this.market.address)).to.be.bignumber.closeTo(new BN(100000 - prorated(this.redeemedAmount, 1)), new BN(1));
          expect(await this.market.totalCoupons()).to.be.bignumber.closeTo(new BN(this.couponAmount - this.redeemedAmount), new BN(1));
          expect(await this.market.totalDebt()).to.be.bignumber.equal(new BN(0));
          expect(await this.market.totalRedeemable()).to.be.bignumber.closeTo(new BN(this.couponAmount - prorated(this.redeemedAmount, 1)), new BN(1));
        });

        it('emits CouponRedemption event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponRedemption', {
            account: userAddress,
          });

          expect(event.args.epoch).to.be.bignumber.equal(new BN(1));
          expect(event.args.amount).to.be.bignumber.equal(new BN(50000));
          expect(event.args.couponAmount).to.be.bignumber.equal(new BN(this.couponAmount / 2));
        });
      });
    });

    describe('after expired', function () {
      this.timeout(30000);

      beforeEach(async function () {
        await this.market.mintToE(this.market.address, 100000);
        await this.market.incrementTotalBondedE(100000);

        for (let i = 0; i < 90; i++) {
          await this.market.incrementEpochE();
        }
        await this.market.stepE();

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
      await this.market.incrementTotalDebtE(100000);
      await this.market.purchaseCoupons(100000, {from: userAddress});
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
        expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.closeTo(new BN(premium(1000000, 100000, 100000)).divn(2), new BN(1));
        expect(await this.market.balanceOfCouponUnderlying(userAddress, 1)).to.be.bignumber.equal(new BN(50000));
        expect(await this.market.balanceOfCoupons(ownerAddress, 1)).to.be.bignumber.closeTo(new BN(premium(1000000, 100000, 100000)).divn(2), new BN(1));
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
        expect(await this.market.balanceOfCoupons(userAddress, 1)).to.be.bignumber.closeTo(new BN(premium(1000000, 100000, 100000)).divn(2), new BN(1));
        expect(await this.market.balanceOfCouponUnderlying(userAddress, 1)).to.be.bignumber.equal(new BN(50000));
        expect(await this.market.balanceOfCoupons(ownerAddress, 1)).to.be.bignumber.closeTo(new BN(premium(1000000, 100000, 100000)).divn(2), new BN(1));
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

  describe('step', function () {
    beforeEach(async function () {
      await this.market.incrementEpochE();
      await this.market.stepE();
    });

    describe('on call without expiration', function () {
      it('initializes coupon expiry', async function () {
        expect(await this.market.couponsExpiration(2)).to.be.bignumber.equal(new BN(92));
        expect(await this.market.expiringCoupons(92)).to.be.bignumber.equal(new BN(1));
        expect(await this.market.expiringCouponsAtIndex(92, 0)).to.be.bignumber.equal(new BN(2));
      });
    });

    describe('on call with expiration', function () {
      this.timeout(30000);

      beforeEach(async function () {
        await this.market.incrementTotalDebtE(100000);
        await this.market.purchaseCoupons(100000, {from: userAddress});

        await this.market.incrementEpochE();
        await this.market.stepE();

        for (let i = 0; i < 89; i++) {
          await this.market.incrementEpochE();
        }
        this.result = await this.market.stepE();
        this.txHash = this.result.tx;
      });

      it('emits CouponExpiration event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponExpiration', { });

        expect(event.args.epoch).to.be.bignumber.equal(new BN(2));
        expect(event.args.couponsExpired).to.be.bignumber.equal(new BN(premium(1000000, 100000, 100000)));
        expect(event.args.lessRedeemable).to.be.bignumber.equal(new BN(0));
        expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
        expect(event.args.newBonded).to.be.bignumber.equal(new BN(0));
      });
    });

    describe('on call with all reclaimed no bonded', function () {
      this.timeout(30000);

      beforeEach(async function () {
        await this.market.incrementTotalDebtE(100000);
        await this.market.purchaseCoupons(100000, {from: userAddress});

        await this.market.mintToE(this.market.address, 100000);
        await this.market.incrementTotalRedeemableE(premium(1000000, 100000, 100000));

        await this.market.incrementEpochE();
        this.result = await this.market.stepE();

        for (let i = 0; i < 89; i++) {
          await this.market.incrementEpochE();
        }
        this.result = await this.market.stepE();
        this.txHash = this.result.tx;
      });

      it('emits CouponExpiration event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponExpiration', { });

        expect(event.args.epoch).to.be.bignumber.equal(new BN(2));
        expect(event.args.couponsExpired).to.be.bignumber.equal(new BN(premium(1000000, 100000, 100000)));
        expect(event.args.lessRedeemable).to.be.bignumber.equal(new BN(premium(1000000, 100000, 100000)));
        expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
        expect(event.args.newBonded).to.be.bignumber.equal(new BN(premium(1000000, 100000, 100000)).muln(225).divn(1000));
      });
    });

    describe('with bonded', function () {
      beforeEach(async function () {
        await this.market.mintToE(this.market.address, 100000);
        await this.market.incrementTotalBondedE(100000);
      });

      describe('on call with all reclaimed', function () {
        this.timeout(30000);

        beforeEach(async function () {
          await this.market.incrementTotalDebtE(100000);
          await this.market.purchaseCoupons(100000, {from: userAddress});

          await this.market.mintToE(this.market.address, 100000);
          await this.market.incrementTotalRedeemableE(premium(1100000, 100000, 100000));

          await this.market.incrementEpochE();
          this.result = await this.market.stepE();

          for (let i = 0; i < 89; i++) {
            await this.market.incrementEpochE();
          }
          this.result = await this.market.stepE();
          this.txHash = this.result.tx;
        });

        it('emits CouponExpiration event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponExpiration', { });

          expect(event.args.epoch).to.be.bignumber.equal(new BN(2));
          expect(event.args.couponsExpired).to.be.bignumber.closeTo(new BN(premium(1100000, 100000, 100000)), new BN(1));
          expect(event.args.lessRedeemable).to.be.bignumber.equal(new BN(premium(1100000, 100000, 100000)));
          expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
          expect(event.args.newBonded).to.be.bignumber.equal(new BN(new BN(premium(1100000, 100000, 100000))));
        });
      });

      describe('on call with some reclaimed', function () {
        this.timeout(30000);

        beforeEach(async function () {
          await this.market.incrementTotalDebtE(100000);
          await this.market.purchaseCoupons(50000, {from: userAddress});

          await this.market.incrementEpochE();
          await this.market.purchaseCoupons(50000, {from: userAddress});

          this.couponAmount = premium(1100000, 100000, 50000) + premium(1050000, 50000, 50000);

          await this.market.mintToE(this.market.address, 100000);
          await this.market.incrementTotalRedeemableE(this.couponAmount);


          this.result = await this.market.stepE();

          for (let i = 0; i < 89; i++) {
            await this.market.incrementEpochE();
          }
          this.result = await this.market.stepE();
          this.txHash = this.result.tx;
        });

        it('emits CouponExpiration event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponExpiration', { });

          expect(event.args.epoch).to.be.bignumber.equal(new BN(2));
          expect(event.args.couponsExpired).to.be.bignumber.equal(new BN(premium(1100000, 100000, 50000)));
          expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
          expect(event.args.newBonded).to.be.bignumber.closeTo(new BN(this.couponAmount - premium(1050000, 50000, 50000)), new BN(1));
        });
      });

      describe('with some debt', function () {
        this.timeout(30000);

        beforeEach(async function () {
          await this.market.incrementTotalDebtE(150000);
          await this.market.purchaseCoupons(50000, {from: userAddress});

          await this.market.incrementEpochE();
          await this.market.purchaseCoupons(50000, {from: userAddress});

          this.couponAmount = premium(1100000, 150000, 50000) +  premium(1050000, 100000, 50000);

          await this.market.mintToE(this.market.address, 100000);
          await this.market.incrementTotalRedeemableE(this.couponAmount);

          this.result = await this.market.stepE();

          for (let i = 0; i < 89; i++) {
            await this.market.incrementEpochE();
          }
          this.result = await this.market.stepE();
          this.txHash = this.result.tx;
        });

        it('emits CouponExpiration event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponExpiration', { });

          expect(event.args.epoch).to.be.bignumber.equal(new BN(2));
          expect(event.args.couponsExpired).to.be.bignumber.equal(new BN(premium(1100000, 150000, 50000)));
          expect(event.args.lessRedeemable).to.be.bignumber.equal(new BN(this.couponAmount - premium(1050000, 100000, 50000)));
          expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
          expect(event.args.newBonded).to.be.bignumber.equal(new BN(this.couponAmount - premium(1050000, 100000, 50000)));
        });
      });

      describe('with more reclaimed than debt', function () {
        this.timeout(30000);

        beforeEach(async function () {
          await this.market.incrementTotalDebtE(120000);
          await this.market.purchaseCoupons(50000, {from: userAddress});

          await this.market.incrementEpochE();
          await this.market.purchaseCoupons(50000, {from: userAddress});

          this.couponAmount = premium(1100000, 120000, 50000) + premium(1050000, 70000, 50000);

          await this.market.mintToE(this.market.address, 100000);
          await this.market.incrementTotalRedeemableE(this.couponAmount);

          this.result = await this.market.stepE()

          for (let i = 0; i < 89; i++) {
            await this.market.incrementEpochE();
          }
          this.result = await this.market.stepE();
          this.txHash = this.result.tx;
        });

        it('emits CouponExpiration event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockMarket, 'CouponExpiration', { });

          expect(event.args.epoch).to.be.bignumber.equal(new BN(2));
          expect(event.args.couponsExpired).to.be.bignumber.equal(new BN(premium(1100000, 120000, 50000)));
          expect(event.args.lessRedeemable).to.be.bignumber.equal(new BN(this.couponAmount - premium(1050000, 70000, 50000)));
          expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
          expect(event.args.newBonded).to.be.bignumber.equal(new BN(this.couponAmount - premium(1050000, 70000, 50000)));
        });
      });
    });
  });
});