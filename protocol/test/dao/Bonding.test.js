const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { accounts, contract } = require("@openzeppelin/test-environment");

const { BN, expectEvent, expectRevert } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

const MockImpl = contract.fromArtifact("MockImpl25");
const Dollar = contract.fromArtifact("Dollar");

const FROZEN = new BN(0);

describe("Bonding", function () {
  const [ownerAddress, userAddress, userAddress1] = accounts;

  beforeEach(async function () {
    this.bonding = await MockImpl.new(ZERO_ADDRESS, {
      from: ownerAddress,
      gas: 8000000,
    });
    this.dollar = await Dollar.at(await this.bonding.dollar());
  });

  describe("when withdraw", function () {
    beforeEach(async function () {
      await this.bonding.mintToE(this.bonding.address, 1000);
      await this.bonding.incrementBalanceOfStagedE(userAddress, 1000);

      this.result = await this.bonding.withdraw(1000, { from: userAddress });
      this.txHash = this.result.tx;
    });

    it("updates users balances", async function () {
      expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(
        new BN(1000)
      );
      expect(await this.bonding.balanceOf(userAddress)).to.be.bignumber.equal(
        new BN(0)
      );
      expect(
        await this.bonding.balanceOfStaged(userAddress)
      ).to.be.bignumber.equal(new BN(0));
      expect(
        await this.bonding.balanceOfBonded(userAddress)
      ).to.be.bignumber.equal(new BN(0));
    });

    it("updates dao balances", async function () {
      expect(
        await this.dollar.balanceOf(this.bonding.address)
      ).to.be.bignumber.equal(new BN(0));
      expect(await this.bonding.totalSupply()).to.be.bignumber.equal(new BN(0));
      expect(await this.bonding.totalBonded()).to.be.bignumber.equal(new BN(0));
      expect(await this.bonding.totalStaged()).to.be.bignumber.equal(new BN(0));
    });

    it("emits Withdraw event", async function () {
      const event = await expectEvent.inTransaction(
        this.txHash,
        MockImpl,
        "Withdraw",
        {
          account: userAddress,
        }
      );

      expect(event.args.value).to.be.bignumber.equal(new BN(1000));
    });
  });

  describe("when withdraw too much", function () {
    beforeEach(async function () {
      await this.bonding.mintToE(this.bonding.address, 1000 + 10000);
      await this.bonding.incrementBalanceOfStagedE(userAddress, 1000);
      await this.bonding.incrementBalanceOfStagedE(userAddress1, 10000);
    });

    it("reverts", async function () {
      await expectRevert(
        this.bonding.withdraw(2000, { from: userAddress }),
        "insufficient staged balance"
      );
    });
  });
});
