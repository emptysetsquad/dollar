const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockUpgradeable = contract.fromArtifact('MockUpgradeable');
const MockImplA = contract.fromArtifact('MockImplA');
const MockImplB = contract.fromArtifact('MockImplB');

describe('Upgradeable', function () {
  const [ ownerAddress ] = accounts;

  beforeEach(async function () {
    this.upgradeable = await MockUpgradeable.new({from: ownerAddress});
    this.implA = await MockImplA.new({from: ownerAddress});
    this.implB = await MockImplB.new({from: ownerAddress});
  });

  describe('set initial implementation', function () {
    beforeEach(async function () {
      this.result = await this.upgradeable.upgradeToE(this.implA.address);
      this.txHash = this.result.tx;
    });

    it('sets implementation correctly', async function () {
      expect(await this.upgradeable.implementation()).to.be.equal(this.implA.address);
      expect(await this.upgradeable.isInitialized(this.implA.address)).to.be.equal(true);
    });

    it('emits MockInitializedA event', async function () {
      await expectEvent.inTransaction(this.txHash, MockImplA, 'MockInitializedA', { });
    });

    it('emits Upgraded event', async function () {
      await expectEvent.inTransaction(this.txHash, MockUpgradeable, 'Upgraded', {
        implementation: this.implA.address
      });
    });
  });

  describe('upgrades after initial implementation', function () {
    beforeEach(async function () {
      await this.upgradeable.upgradeToE(this.implA.address);
      this.result = await this.upgradeable.upgradeToE(this.implB.address);
      this.txHash = this.result.tx;
    });

    it('sets implementation correctly', async function () {
      expect(await this.upgradeable.implementation()).to.be.equal(this.implB.address);
      expect(await this.upgradeable.isInitialized(this.implB.address)).to.be.equal(true);
    });

    it('emits MockInitializedA event', async function () {
      await expectEvent.inTransaction(this.txHash, MockImplB, 'MockInitializedB', { });
    });

    it('emits Upgraded event', async function () {
      await expectEvent.inTransaction(this.txHash, MockUpgradeable, 'Upgraded', {
        implementation: this.implB.address
      });
    });
  });
});