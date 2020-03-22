const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockCurve = contract.fromArtifact('MockCurve');

describe('Curve', function () {
  const [ ownerAddress ] = accounts;

  beforeEach(async function () {
    this.curve = await MockCurve.new({from: ownerAddress});
  });

  describe('amount is zero below threshold', function () {
      it('reverts', async function () {
        expect(await this.curve.calculateCouponsE(100000, 10000, 0)).to.be.bignumber.equal(new BN(0));
      });
  });

  describe('amount is zero above threshold', function () {
    it('reverts', async function () {
      expect(await this.curve.calculateCouponsE(100000, 50000, 0)).to.be.bignumber.equal(new BN(0));
    });
  });

  describe('total supply is zero', function () {
    it('reverts', async function () {
      await expectRevert(this.curve.calculateCouponsE(0, 0, 0), "division by zero");
    });
  });

  describe('amount larger than total supply', function () {
    it('reverts', async function () {
      await expectRevert(this.curve.calculateCouponsE(100, 50, 110), "subtraction overflow");
    });
  });

  describe('amount larger than total debt', function () {
    it('reverts', async function () {
      await expectRevert(this.curve.calculateCouponsE(100, 50, 60), "subtraction overflow");
    });
  });

  describe('10-100-10: 0.0037037 - not enough to round to unit', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100, 10, 10)).to.be.bignumber.equal(new BN(0));
    });
  });

  describe('100000-10000-10000: 370.37 - should add 370', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 10000, 10000)).to.be.bignumber.equal(new BN(370));
    });
  });

  describe('100000-10000-5000: 288.066 - should add 288', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 10000, 5000)).to.be.bignumber.equal(new BN(288));
    });
  });

  describe('100000-50000-10000: 0.346939 (above threshold) - should add 3469', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 50000, 10000)).to.be.bignumber.equal(new BN(3469));
    });
  });

  /* 40000/100000 -> 20000/80000
   * 0.4 -> 0.25
   * 0.3 - 0.4 (above threshold) + 0.25 - 0.3 (below threshold)
   * (0.1 * 0.346939 + 0.05 * 0.301587) / 0.15 = 0.331822
   */
  describe('100000-40000-20000: 6636.44 (above and below threshold) - should add 6636', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 40000, 20000)).to.be.bignumber.equal(new BN(6636));
    });
  });
});