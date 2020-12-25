const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert } = require('@openzeppelin/test-helpers');
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

  describe('5-100-5: 0.26315 - not enough to round to unit', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100, 5, 5)).to.be.bignumber.equal(new BN(0));
    });
  });

  describe('100000-5000-5000: 263.15 - should add 263', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 5000, 5000)).to.be.bignumber.equal(new BN(263));
    });
  });

  describe('100000-10000-5000: 864.19 - should add 864', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 10000, 5000)).to.be.bignumber.equal(new BN(864));
    });
  });

  describe('100000-70000-10000: 0.384083 (above threshold) - should add 3840', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 70000, 10000)).to.be.bignumber.equal(new BN(3840));
    });
  });

  /* 60000/100000 -> 5000/45000
   * 0.6 -> 1/9
   * 0.6 - 0.15 (above threshold) + 1/9 - 0.15 (below threshold)
   * (0.45 * 0.384083 + (0.15-1/9) * 0.323529) / (0.6-1/9) = 0.379266
   */
  describe('100000-60000-55000: 20859 (above and below threshold) - should add 20859', function () {
    it('returns correct amount', async function () {
      expect(await this.curve.calculateCouponsE(100000, 60000, 55000)).to.be.bignumber.equal(new BN(20859));
    });
  });
});