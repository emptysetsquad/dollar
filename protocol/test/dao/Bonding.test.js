const { ZERO_ADDRESS } = require("@openzeppelin/test-helpers/src/constants");
const { accounts, contract } = require("@openzeppelin/test-environment");

const {
  BN,
  expectEvent,
  expectRevert,
  time,
} = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

const MockBonding = contract.fromArtifact("MockBonding");
const Dollar = contract.fromArtifact("Dollar");

const INITIAL_STAKE_MULTIPLE = new BN(10).pow(new BN(6)); // 100 ESD -> 100M ESDS

const FROZEN = new BN(0);
const FLUID = new BN(1);
const LOCKED = new BN(2);

describe("Bonding", function () {
  const [ownerAddress, userAddress, userAddress1, userAddress2] = accounts;

  beforeEach(async function () {
    this.bonding = await MockBonding.new({ from: ownerAddress, gas: 8000000 });
    this.dollar = await Dollar.at(await this.bonding.dollar());

    await this.bonding.setEpochParamsE(await time.latest(), 86400);
    await time.increase(86400);
    await this.bonding.stepE();
  });

  describe("frozen", function () {
    describe("starts as frozen", function () {
      it("mints new Dollar tokens", async function () {
        expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(
          FROZEN
        );
      });
    });

    describe("when withdraw", function () {
      beforeEach(async function () {
        await this.bonding.mintToE(this.bonding.address, 1000);
        await this.bonding.incrementBalanceOfStagedE(userAddress, 1000);

        this.result = await this.bonding.withdraw(1000, { from: userAddress });
        this.txHash = this.result.tx;
      });

      it("is frozen", async function () {
        expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(
          FROZEN
        );
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
        expect(await this.bonding.totalSupply()).to.be.bignumber.equal(
          new BN(0)
        );
        expect(await this.bonding.totalBonded()).to.be.bignumber.equal(
          new BN(0)
        );
        expect(await this.bonding.totalStaged()).to.be.bignumber.equal(
          new BN(0)
        );
      });

      it("emits Withdraw event", async function () {
        const event = await expectEvent.inTransaction(
          this.txHash,
          MockBonding,
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

  describe("fluid", function () {
    beforeEach(async function () {
      await this.bonding.unfreezeE(userAddress);
      await this.bonding.incrementBalanceOfE(userAddress, 1000);
      await this.bonding.incrementTotalBondedE(1000);
      await this.bonding.mintToE(this.bonding.address, 1000);
    });

    it("is fluid", async function () {
      expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(
        FLUID
      );
    });

    describe("when withdraw", function () {
      it("reverts", async function () {
        await expectRevert(
          this.bonding.withdraw(1000, { from: userAddress }),
          "Permission: Not frozen"
        );
      });
    });
  });

  describe("locked", function () {
    beforeEach(async function () {
      await this.bonding.createCandidateE(ownerAddress, 7);
      await this.bonding.placeLockE(userAddress, ownerAddress);
    });

    it("is locked", async function () {
      expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(
        LOCKED
      );
    });

    describe("when withdraw", function () {
      beforeEach(async function () {
        await this.bonding.mintToE(this.bonding.address, 1000);
        await this.bonding.incrementBalanceOfStagedE(userAddress, 1000);
        this.result = await this.bonding.withdraw(1000, { from: userAddress });
      });

      it("doesnt revert", async function () {
        expect(this.result.tx).to.be.not.empty;
      });
    });
  });

  describe("when step", function () {
    beforeEach(async function () {
      /* Deposit and Bond User */
      await this.bonding.mintToE(this.bonding.address, 1000);
      await this.bonding.unfreezeE(userAddress);
      await this.bonding.incrementBalanceOfE(
        userAddress,
        1000 * INITIAL_STAKE_MULTIPLE
      );
      await this.bonding.incrementTotalBondedE(1000);

      await time.increase(86400);
      await this.bonding.stepE({ from: userAddress });

      /* Payout to Bonded */
      await this.bonding.mintToE(this.bonding.address, 1000);
      await this.bonding.incrementTotalBondedE(1000);

      /* Deposit and Bond User 1+2 */
      await this.bonding.mintToE(this.bonding.address, 1000);
      await this.bonding.unfreezeE(userAddress1);
      await this.bonding.incrementBalanceOfE(
        userAddress1,
        (1000 * INITIAL_STAKE_MULTIPLE) / 2
      );
      await this.bonding.incrementTotalBondedE(1000);

      await this.bonding.mintToE(this.bonding.address, 1000);
      await this.bonding.unfreezeE(userAddress2);
      await this.bonding.incrementBalanceOfE(
        userAddress2,
        (1000 * INITIAL_STAKE_MULTIPLE) / 2
      );
      await this.bonding.incrementTotalBondedE(1000);

      await time.increase(86400);
      await this.bonding.stepE({ from: userAddress });

      /* Unbond User */
      await this.bonding.unfreezeE(userAddress);
      await this.bonding.decrementBalanceOfE(
        userAddress,
        1000 * INITIAL_STAKE_MULTIPLE,
        ""
      );
      await this.bonding.decrementTotalBondedE(2000, "");

      await time.increase(86400);
    });

    describe("preceeding epoch cooldown", function () {
      it("user is fluid", async function () {
        expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(
          FLUID
        );
      });

      it("is correct epoch", async function () {
        expect(await this.bonding.epoch()).to.be.bignumber.equal(new BN(3));
      });
    });

    describe("after epoch lock cooldown", function () {
      beforeEach(async function () {
        await this.bonding.stepE({ from: userAddress });
      });

      it("user is frozen", async function () {
        expect(await this.bonding.statusOf(userAddress)).to.be.bignumber.equal(
          FROZEN
        );
      });

      it("is correct epoch", async function () {
        expect(await this.bonding.epoch()).to.be.bignumber.equal(new BN(4));
      });

      it("has correct snapshots", async function () {
        expect(await this.bonding.totalBondedAt(0)).to.be.bignumber.equal(
          new BN(0)
        );
        expect(await this.bonding.totalBondedAt(1)).to.be.bignumber.equal(
          new BN(1000).mul(INITIAL_STAKE_MULTIPLE)
        );
        expect(await this.bonding.totalBondedAt(2)).to.be.bignumber.equal(
          new BN(2000).mul(INITIAL_STAKE_MULTIPLE)
        );
        expect(await this.bonding.totalBondedAt(3)).to.be.bignumber.equal(
          new BN(1000).mul(INITIAL_STAKE_MULTIPLE)
        );
      });
    });
  });
});
