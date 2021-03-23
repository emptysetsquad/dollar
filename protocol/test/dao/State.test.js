const { accounts, contract } = require("@openzeppelin/test-environment");

const { BN, expectRevert, time } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

const MockState = contract.fromArtifact("MockState");

const BOOTSTRAPPING_END_TIMESTAMP = 1600905600;
const EPOCH_START = 1602288000;
const EPOCH_OFFSET = 107;

describe("State", function () {
  const [ownerAddress, userAddress, candidate] = accounts;

  beforeEach(async function () {
    this.setters = await MockState.new({ from: ownerAddress });
  });

  /**
   * Erc20 Implementation
   */

  describe("erc20 details", function () {
    describe("name", function () {
      it("increments total bonded", async function () {
        expect(await this.setters.name()).to.be.equal("Empty Set Dollar Stake");
      });
    });

    describe("symbol", function () {
      it("increments total bonded", async function () {
        expect(await this.setters.symbol()).to.be.equal("ESDS");
      });
    });

    describe("decimals", function () {
      it("increments total bonded", async function () {
        expect(await this.setters.decimals()).to.be.bignumber.equal(new BN(18));
      });
    });
  });

  describe("approve", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        this.success = await this.setters.approve.call(ownerAddress, 100, {
          from: userAddress,
        });
      });

      it("increments total bonded", async function () {
        expect(this.success).to.be.equal(false);
      });
    });
  });

  describe("transfer", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfE(userAddress, 100);
        this.success = await this.setters.transfer.call(ownerAddress, 100, {
          from: userAddress,
        });
      });

      it("increments total bonded", async function () {
        expect(this.success).to.be.equal(false);
      });
    });
  });

  describe("transferFrom", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfE(userAddress, 100);
        this.success = await this.setters.transferFrom.call(
          userAddress,
          ownerAddress,
          100,
          { from: userAddress }
        );
      });

      it("increments total bonded", async function () {
        expect(this.success).to.be.equal(false);
      });
    });
  });

  describe("allowance", function () {
    describe("when called", function () {
      beforeEach("not revert", async function () {
        this.allowance = await this.setters.allowance(
          userAddress,
          ownerAddress
        );
      });

      it("is 0", async function () {
        expect(this.allowance).to.be.bignumber.equal(new BN(0));
      });
    });
  });

  /**
   * Global
   */

  describe("incrementTotalBonded", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementTotalBondedE(100);
        await this.setters.incrementTotalBondedE(100);
      });

      it("increments total bonded", async function () {
        expect(await this.setters.totalBonded()).to.be.bignumber.equal(
          new BN(200)
        );
      });
    });
  });

  describe("decrementTotalBonded", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementTotalBondedE(500);
        await this.setters.decrementTotalBondedE(
          100,
          "decrementTotalBondedE - 1"
        );
        await this.setters.decrementTotalBondedE(
          100,
          "decrementTotalBondedE - 2"
        );
      });

      it("decrements total bonded", async function () {
        expect(await this.setters.totalBonded()).to.be.bignumber.equal(
          new BN(300)
        );
      });
    });

    describe("when called erroneously", function () {
      beforeEach("call", async function () {
        await this.setters.incrementTotalBondedE(100);
      });

      it("reverts", async function () {
        await expectRevert(
          this.setters.decrementTotalBondedE(200, "decrementTotalBondedE"),
          "decrementTotalBondedE"
        );
      });
    });
  });

  /**
   * Account
   */

  describe("incrementBalanceOf", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfE(userAddress, 100);
        await this.setters.incrementBalanceOfE(userAddress, 100);
      });

      it("increments balance of user", async function () {
        expect(await this.setters.balanceOf(userAddress)).to.be.bignumber.equal(
          new BN(200)
        );
      });

      it("increments total supply", async function () {
        expect(await this.setters.totalSupply()).to.be.bignumber.equal(
          new BN(200)
        );
      });
    });
  });

  describe("decrementBalanceOf", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfE(userAddress, 500);
        await this.setters.decrementBalanceOfE(
          userAddress,
          100,
          "decrementBalanceOfE - 1"
        );
        await this.setters.decrementBalanceOfE(
          userAddress,
          100,
          "decrementBalanceOfE - 2"
        );
      });

      it("decrements balance of user", async function () {
        expect(await this.setters.balanceOf(userAddress)).to.be.bignumber.equal(
          new BN(300)
        );
      });

      it("decrements total supply", async function () {
        expect(await this.setters.totalSupply()).to.be.bignumber.equal(
          new BN(300)
        );
      });
    });

    describe("when called erroneously", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfE(userAddress, 100);
      });

      it("reverts", async function () {
        await expectRevert(
          this.setters.decrementBalanceOfE(200, "decrementBalanceOfE"),
          "decrementBalanceOfE"
        );
      });
    });
  });

  describe("incrementBalanceOfStaged", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfStagedE(userAddress, 100);
        await this.setters.incrementBalanceOfStagedE(userAddress, 100);
      });

      it("increments balance of staged for user", async function () {
        expect(
          await this.setters.balanceOfStaged(userAddress)
        ).to.be.bignumber.equal(new BN(200));
      });

      it("increments total staged", async function () {
        expect(await this.setters.totalStaged()).to.be.bignumber.equal(
          new BN(200)
        );
      });
    });
  });

  describe("decrementBalanceOfStaged", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfStagedE(userAddress, 500);
        await this.setters.decrementBalanceOfStagedE(
          userAddress,
          100,
          "decrementBalanceOfStagedE - 1"
        );
        await this.setters.decrementBalanceOfStagedE(
          userAddress,
          100,
          "decrementBalanceOfStagedE - 2"
        );
      });

      it("decrements balance of staged for user", async function () {
        expect(
          await this.setters.balanceOfStaged(userAddress)
        ).to.be.bignumber.equal(new BN(300));
      });

      it("decrements total staged", async function () {
        expect(await this.setters.totalStaged()).to.be.bignumber.equal(
          new BN(300)
        );
      });
    });

    describe("when called erroneously", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfStagedE(userAddress, 100);
      });

      it("reverts", async function () {
        await expectRevert(
          this.setters.decrementBalanceOfStagedE(
            200,
            "decrementBalanceOfStagedE"
          ),
          "decrementBalanceOfStagedE"
        );
      });
    });
  });

  describe("incrementBalanceOfCouponUnderlying", function () {
    const epoch = 1;

    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfCouponUnderlyingE(
          userAddress,
          epoch,
          100
        );
        await this.setters.incrementBalanceOfCouponUnderlyingE(
          userAddress,
          epoch,
          100
        );
      });

      it("increments balance of coupons for user during epoch", async function () {
        expect(
          await this.setters.balanceOfCouponUnderlying(userAddress, epoch)
        ).to.be.bignumber.equal(new BN(200));
      });

      it("increments total outstanding coupons", async function () {
        expect(
          await this.setters.totalCouponUnderlying()
        ).to.be.bignumber.equal(new BN(200));
      });
    });
  });

  describe("decrementBalanceOfCouponUnderlying", function () {
    const epoch = 1;

    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfCouponUnderlyingE(
          userAddress,
          epoch,
          500
        );
        await this.setters.decrementBalanceOfCouponUnderlyingE(
          userAddress,
          epoch,
          100,
          "decrementBalanceOfCouponsE - 1"
        );
        await this.setters.decrementBalanceOfCouponUnderlyingE(
          userAddress,
          epoch,
          100,
          "decrementBalanceOfCouponsE - 2"
        );
      });

      it("decrements balance of coupons for user during epoch", async function () {
        expect(
          await this.setters.balanceOfCouponUnderlying(userAddress, epoch)
        ).to.be.bignumber.equal(new BN(300));
      });

      it("decrements total outstanding coupons", async function () {
        expect(
          await this.setters.totalCouponUnderlying()
        ).to.be.bignumber.equal(new BN(300));
      });
    });

    describe("when called erroneously", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfCouponUnderlyingE(
          userAddress,
          epoch,
          100
        );
      });

      it("reverts", async function () {
        await expectRevert(
          this.setters.decrementBalanceOfCouponUnderlyingE(
            userAddress,
            200,
            epoch,
            "decrementBalanceOfCouponsE"
          ),
          "decrementBalanceOfCouponsE"
        );
      });
    });
  });

  describe("balanceOfBonded", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfE(userAddress, 100);
        await this.setters.incrementTotalBondedE(100);
        await this.setters.incrementBalanceOfE(ownerAddress, 200);
        await this.setters.incrementTotalBondedE(200);
      });

      it("returns balance of bonded", async function () {
        expect(
          await this.setters.balanceOfBonded(userAddress)
        ).to.be.bignumber.equal(new BN(100));
      });
    });

    describe("pool reward", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfE(userAddress, 100);
        await this.setters.incrementTotalBondedE(100);

        await this.setters.incrementBalanceOfE(ownerAddress, 200);
        await this.setters.incrementTotalBondedE(200);

        await this.setters.incrementTotalBondedE(150);
      });

      it("increments balance of bonded", async function () {
        expect(
          await this.setters.balanceOfBonded(userAddress)
        ).to.be.bignumber.equal(new BN(150));
      });
    });

    describe("pool reward and withdrawal", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfE(userAddress, 100);
        await this.setters.incrementTotalBondedE(100);

        await this.setters.incrementBalanceOfE(ownerAddress, 200);
        await this.setters.incrementTotalBondedE(200);

        await this.setters.incrementTotalBondedE(150);

        await this.setters.decrementBalanceOfE(
          ownerAddress,
          200,
          "decrementBalanceOfE"
        );
        await this.setters.decrementTotalBondedE(300, "decrementTotalBondedE");
      });

      it("increments balance of bonded", async function () {
        expect(
          await this.setters.balanceOfBonded(userAddress)
        ).to.be.bignumber.equal(new BN(150));
      });
    });
  });

  describe("unfreeze", function () {
    describe("before called", function () {
      it("is frozen", async function () {
        expect(await this.setters.statusOf(userAddress)).to.be.bignumber.equal(
          new BN(0)
        );
        expect(
          await this.setters.fluidUntil(userAddress)
        ).to.be.bignumber.equal(new BN(0));
      });
    });

    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.unfreezeE(userAddress);
      });

      it("is fluid", async function () {
        expect(await this.setters.statusOf(userAddress)).to.be.bignumber.equal(
          new BN(1)
        );
        expect(
          await this.setters.fluidUntil(userAddress)
        ).to.be.bignumber.equal(new BN(1));
      });
    });

    describe("when called then advanced within lockup", function () {
      beforeEach("call", async function () {
        await this.setters.unfreezeE(userAddress);
      });

      it("is fluid", async function () {
        expect(await this.setters.statusOf(userAddress)).to.be.bignumber.equal(
          new BN(1)
        );
        expect(
          await this.setters.fluidUntil(userAddress)
        ).to.be.bignumber.equal(new BN(1));
      });
    });

    describe("when called then advanced after lockup", function () {
      beforeEach("call", async function () {
        await this.setters.unfreezeE(userAddress);
        await this.setters.incrementEpochE();
      });

      it("is frozen", async function () {
        expect(await this.setters.statusOf(userAddress)).to.be.bignumber.equal(
          new BN(0)
        );
        expect(
          await this.setters.fluidUntil(userAddress)
        ).to.be.bignumber.equal(new BN(1));
      });
    });
  });

  describe("updateAllowanceCoupons", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.updateAllowanceCouponsE(
          userAddress,
          ownerAddress,
          100
        );
      });

      it("updates coupon allowance", async function () {
        expect(
          await this.setters.allowanceCoupons(userAddress, ownerAddress)
        ).to.be.bignumber.equal(new BN(100));
      });
    });

    describe("when called multiple", function () {
      beforeEach("call", async function () {
        await this.setters.updateAllowanceCouponsE(
          userAddress,
          ownerAddress,
          100
        );
        await this.setters.updateAllowanceCouponsE(
          userAddress,
          ownerAddress,
          200
        );
      });

      it("updates coupon allowance", async function () {
        expect(
          await this.setters.allowanceCoupons(userAddress, ownerAddress)
        ).to.be.bignumber.equal(new BN(200));
      });
    });
  });

  describe("decrementAllowanceCoupons", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.updateAllowanceCouponsE(
          userAddress,
          ownerAddress,
          500
        );
        await this.setters.decrementAllowanceCouponsE(
          userAddress,
          ownerAddress,
          100,
          "decrementCouponAllowanceE - 1"
        );
      });

      it("decrements coupon allowance", async function () {
        expect(
          await this.setters.allowanceCoupons(userAddress, ownerAddress)
        ).to.be.bignumber.equal(new BN(400));
      });
    });

    describe("when called erroneously", function () {
      beforeEach("call", async function () {
        await this.setters.updateAllowanceCouponsE(
          userAddress,
          ownerAddress,
          100
        );
      });

      it("reverts", async function () {
        await expectRevert(
          this.setters.decrementAllowanceCouponsE(
            userAddress,
            ownerAddress,
            200,
            "decrementAllowanceCouponsE"
          ),
          "decrementAllowanceCouponsE"
        );
      });
    });
  });

  /**
   * Epoch
   */

  describe("epochTime", function () {
    beforeEach("call", async function () {
      await this.setters.setBlockTimestamp(BOOTSTRAPPING_END_TIMESTAMP);
    });

    describe("before start", function () {
      it("is 91", async function () {
        expect(await this.setters.epochTime()).to.be.bignumber.equal(
          new BN(91)
        );
      });
    });

    describe("after one period", function () {
      beforeEach("call", async function () {
        await this.setters.setBlockTimestamp(
          BOOTSTRAPPING_END_TIMESTAMP + 86400
        );
      });

      it("has advanced", async function () {
        expect(await this.setters.epochTime()).to.be.bignumber.equal(
          new BN(92)
        );
      });
    });

    describe("after many periods", function () {
      beforeEach("call", async function () {
        await this.setters.setBlockTimestamp(
          BOOTSTRAPPING_END_TIMESTAMP + 10 * 86400
        );
      });

      it("has advanced", async function () {
        expect(await this.setters.epochTime()).to.be.bignumber.equal(
          new BN(101)
        );
      });
    });

    describe("one before update advance", function () {
      beforeEach("call", async function () {
        await this.setters.setBlockTimestamp(
          BOOTSTRAPPING_END_TIMESTAMP + 14 * 86400
        );
      });

      it("has advanced", async function () {
        expect(await this.setters.epochTime()).to.be.bignumber.equal(
          new BN(105)
        );
      });
    });

    describe("right before update advance", function () {
      beforeEach("call", async function () {
        await this.setters.setBlockTimestamp(
          BOOTSTRAPPING_END_TIMESTAMP + 15 * 86400 - 1
        );
      });

      it("has advanced", async function () {
        expect(await this.setters.epochTime()).to.be.bignumber.equal(
          new BN(105)
        );
      });
    });

    describe("at update advance", function () {
      beforeEach("call", async function () {
        await this.setters.setBlockTimestamp(
          BOOTSTRAPPING_END_TIMESTAMP + 15 * 86400
        );
      });

      it("has advanced", async function () {
        expect(await this.setters.epochTime()).to.be.bignumber.equal(
          new BN(106)
        );
      });
    });

    describe("at first after update advance", function () {
      beforeEach("call", async function () {
        await this.setters.setBlockTimestamp(
          BOOTSTRAPPING_END_TIMESTAMP + 15 * 86400 + 28800
        );
      });

      it("has advanced", async function () {
        expect(await this.setters.epochTime()).to.be.bignumber.equal(
          new BN(107)
        );
      });
    });

    describe("many after update advance", function () {
      beforeEach("call", async function () {
        await this.setters.setBlockTimestamp(
          BOOTSTRAPPING_END_TIMESTAMP + 15 * 86400 + 10 * 28800
        );
      });

      it("has advanced", async function () {
        expect(await this.setters.epochTime()).to.be.bignumber.equal(
          new BN(116)
        );
      });
    });
  });

  describe("incrementEpoch", function () {
    describe("before called", function () {
      it("is 0", async function () {
        expect(await this.setters.epoch()).to.be.bignumber.equal(new BN(0));
      });
    });

    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementEpochE();
      });

      it("is unbonding", async function () {
        expect(await this.setters.epoch()).to.be.bignumber.equal(new BN(1));
      });
    });

    describe("when called multiple times", function () {
      beforeEach("call", async function () {
        await this.setters.incrementEpochE();
        await this.setters.incrementEpochE();
      });

      it("is bonded", async function () {
        expect(await this.setters.epoch()).to.be.bignumber.equal(new BN(2));
      });
    });
  });

  describe("snapshotTotalBonded", function () {
    beforeEach("call", async function () {
      await this.setters.incrementEpochE();
    });

    describe("before called", function () {
      it("is 0", async function () {
        expect(await this.setters.totalBondedAt(1)).to.be.bignumber.equal(
          new BN(0)
        );
      });
    });

    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfE(userAddress, 100);
        await this.setters.snapshotTotalBondedE();
      });

      it("is snapshotted", async function () {
        expect(await this.setters.totalBondedAt(1)).to.be.bignumber.equal(
          new BN(100)
        );
      });
    });

    describe("when called multiple times", function () {
      beforeEach("call", async function () {
        await this.setters.incrementBalanceOfE(userAddress, 100);
        await this.setters.snapshotTotalBondedE();
        await this.setters.incrementEpochE();

        await this.setters.incrementBalanceOfE(userAddress, 100);
        await this.setters.snapshotTotalBondedE();
      });

      it("is snapshotted for both epochs", async function () {
        expect(await this.setters.totalBondedAt(1)).to.be.bignumber.equal(
          new BN(100)
        );
        expect(await this.setters.totalBondedAt(2)).to.be.bignumber.equal(
          new BN(200)
        );
      });
    });
  });

  describe("incrementEpoch", function () {
    describe("before called", function () {
      it("is 0", async function () {
        expect(await this.setters.epoch()).to.be.bignumber.equal(new BN(0));
      });
    });

    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementEpochE();
      });

      it("is unbonding", async function () {
        expect(await this.setters.epoch()).to.be.bignumber.equal(new BN(1));
      });
    });

    describe("when called multiple times", function () {
      beforeEach("call", async function () {
        await this.setters.incrementEpochE();
        await this.setters.incrementEpochE();
      });

      it("is bonded", async function () {
        expect(await this.setters.epoch()).to.be.bignumber.equal(new BN(2));
      });
    });
  });

  /**
   * Governance
   */

  describe("createCandidate", function () {
    beforeEach("call", async function () {
      await this.setters.incrementEpochE();
    });

    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.createCandidateE(candidate, 7);
      });

      it("has start and period set", async function () {
        expect(await this.setters.startFor(candidate)).to.be.bignumber.equal(
          new BN(1)
        );
        expect(await this.setters.periodFor(candidate)).to.be.bignumber.equal(
          new BN(7)
        );
        expect(await this.setters.isNominated(candidate)).to.be.equal(true);
      });
    });
  });

  describe("recordVote", function () {
    beforeEach("call", async function () {
      await this.setters.incrementEpochE();
    });

    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.recordVoteE(userAddress, candidate, 1);
      });

      it("has recorded vote set", async function () {
        expect(
          await this.setters.recordedVote(userAddress, candidate)
        ).to.be.bignumber.equal(new BN(1));
      });
    });

    describe("when unvoting", function () {
      beforeEach("call", async function () {
        await this.setters.recordVoteE(userAddress, candidate, 1);
        await this.setters.recordVoteE(userAddress, candidate, 0);
      });

      it("has recorded vote set", async function () {
        expect(
          await this.setters.recordedVote(userAddress, candidate)
        ).to.be.bignumber.equal(new BN(0));
      });
    });

    describe("when revoting", function () {
      beforeEach("call", async function () {
        await this.setters.recordVoteE(userAddress, candidate, 1);
        await this.setters.recordVoteE(userAddress, candidate, 2);
      });

      it("has recorded vote set", async function () {
        expect(
          await this.setters.recordedVote(userAddress, candidate)
        ).to.be.bignumber.equal(new BN(2));
      });
    });
  });

  describe("incrementApproveFor", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementApproveForE(candidate, 100);
      });

      it("has approve for set", async function () {
        expect(await this.setters.approveFor(candidate)).to.be.bignumber.equal(
          new BN(100)
        );
        expect(await this.setters.votesFor(candidate)).to.be.bignumber.equal(
          new BN(100)
        );
      });
    });

    describe("when called multiple", function () {
      beforeEach("call", async function () {
        await this.setters.incrementApproveForE(candidate, 100);
        await this.setters.incrementApproveForE(candidate, 200);
      });

      it("has approve for set", async function () {
        expect(await this.setters.approveFor(candidate)).to.be.bignumber.equal(
          new BN(300)
        );
        expect(await this.setters.votesFor(candidate)).to.be.bignumber.equal(
          new BN(300)
        );
      });
    });
  });

  describe("decrementApproveFor", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementApproveForE(candidate, 1000);
        await this.setters.decrementApproveForE(
          candidate,
          100,
          "decrementApproveForE"
        );
      });

      it("has approve for set", async function () {
        expect(await this.setters.approveFor(candidate)).to.be.bignumber.equal(
          new BN(900)
        );
        expect(await this.setters.votesFor(candidate)).to.be.bignumber.equal(
          new BN(900)
        );
      });
    });

    describe("when called multiple", function () {
      beforeEach("call", async function () {
        await this.setters.incrementApproveForE(candidate, 1000);
        await this.setters.decrementApproveForE(
          candidate,
          100,
          "decrementApproveForE"
        );
        await this.setters.decrementApproveForE(
          candidate,
          200,
          "decrementApproveForE"
        );
      });

      it("has approve for set", async function () {
        expect(await this.setters.approveFor(candidate)).to.be.bignumber.equal(
          new BN(700)
        );
        expect(await this.setters.votesFor(candidate)).to.be.bignumber.equal(
          new BN(700)
        );
      });
    });

    describe("when called erroneously", function () {
      beforeEach("call", async function () {
        await this.setters.incrementApproveForE(candidate, 1000);
      });

      it("reverts", async function () {
        await expectRevert(
          this.setters.decrementApproveForE(
            candidate,
            1100,
            "decrementApproveForE"
          ),
          "decrementApproveForE"
        );
      });
    });
  });

  describe("incrementRejectFor", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementRejectForE(candidate, 100);
      });

      it("has reject for set", async function () {
        expect(await this.setters.rejectFor(candidate)).to.be.bignumber.equal(
          new BN(100)
        );
        expect(await this.setters.votesFor(candidate)).to.be.bignumber.equal(
          new BN(100)
        );
      });
    });

    describe("when called multiple", function () {
      beforeEach("call", async function () {
        await this.setters.incrementRejectForE(candidate, 100);
        await this.setters.incrementRejectForE(candidate, 200);
      });

      it("has reject for set", async function () {
        expect(await this.setters.rejectFor(candidate)).to.be.bignumber.equal(
          new BN(300)
        );
        expect(await this.setters.votesFor(candidate)).to.be.bignumber.equal(
          new BN(300)
        );
      });
    });
  });

  describe("decrementRejectFor", function () {
    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.incrementRejectForE(candidate, 1000);
        await this.setters.decrementRejectForE(
          candidate,
          100,
          "decrementRejectForE"
        );
      });

      it("has reject for set", async function () {
        expect(await this.setters.rejectFor(candidate)).to.be.bignumber.equal(
          new BN(900)
        );
        expect(await this.setters.votesFor(candidate)).to.be.bignumber.equal(
          new BN(900)
        );
      });
    });

    describe("when called multiple", function () {
      beforeEach("call", async function () {
        await this.setters.incrementRejectForE(candidate, 1000);
        await this.setters.decrementRejectForE(
          candidate,
          100,
          "decrementRejectForE"
        );
        await this.setters.decrementRejectForE(
          candidate,
          200,
          "decrementRejectForE"
        );
      });

      it("has reject for set", async function () {
        expect(await this.setters.rejectFor(candidate)).to.be.bignumber.equal(
          new BN(700)
        );
        expect(await this.setters.votesFor(candidate)).to.be.bignumber.equal(
          new BN(700)
        );
      });
    });

    describe("when called erroneously", function () {
      beforeEach("call", async function () {
        await this.setters.incrementRejectForE(candidate, 1000);
      });

      it("reverts", async function () {
        await expectRevert(
          this.setters.decrementRejectForE(
            candidate,
            1100,
            "decrementRejectForE"
          ),
          "decrementRejectForE"
        );
      });
    });
  });

  describe("placeLock", function () {
    beforeEach("call", async function () {
      await this.setters.incrementEpochE();
      await this.setters.createCandidateE(candidate, 7);
    });

    describe("when voting", function () {
      beforeEach("call", async function () {
        await this.setters.placeLockE(userAddress, candidate);
      });

      it("should have locked user", async function () {
        expect(await this.setters.isNominated(candidate)).to.be.equal(true);
        expect(await this.setters.statusOf(userAddress)).to.be.bignumber.equal(
          new BN(2)
        );
        expect(
          await this.setters.lockedUntil(userAddress)
        ).to.be.bignumber.equal(new BN(8));
      });
    });

    describe("when voting then wait", function () {
      beforeEach("call", async function () {
        await this.setters.placeLockE(userAddress, candidate);

        await this.setters.incrementEpochE(); // 2
        await this.setters.incrementEpochE(); // 3
        await this.setters.incrementEpochE(); // 4
        await this.setters.incrementEpochE(); // 5
        await this.setters.incrementEpochE(); // 6
        await this.setters.incrementEpochE(); // 7
        await this.setters.incrementEpochE(); // 8
      });

      it("should have unlocked user", async function () {
        expect(await this.setters.isNominated(candidate)).to.be.equal(true);
        expect(await this.setters.statusOf(userAddress)).to.be.bignumber.equal(
          new BN(0)
        );
        expect(
          await this.setters.lockedUntil(userAddress)
        ).to.be.bignumber.equal(new BN(8));
      });
    });

    describe("when voting multiple", function () {
      beforeEach("call", async function () {
        await this.setters.placeLockE(userAddress, candidate);

        await this.setters.incrementEpochE(); // 2
        await this.setters.incrementEpochE(); // 3
        await this.setters.createCandidateE(ownerAddress, 7);
        await this.setters.placeLockE(userAddress, ownerAddress);
      });

      describe("and not waiting", function () {
        beforeEach("call", async function () {
          await this.setters.incrementEpochE(); // 4
          await this.setters.incrementEpochE(); // 5
          await this.setters.incrementEpochE(); // 6
          await this.setters.incrementEpochE(); // 7
          await this.setters.incrementEpochE(); // 8
        });

        it("should still lock user", async function () {
          expect(await this.setters.isNominated(candidate)).to.be.equal(true);
          expect(await this.setters.isNominated(ownerAddress)).to.be.equal(
            true
          );
          expect(
            await this.setters.statusOf(userAddress)
          ).to.be.bignumber.equal(new BN(2));
          expect(
            await this.setters.lockedUntil(userAddress)
          ).to.be.bignumber.equal(new BN(10));
        });
      });

      describe("and waiting", function () {
        beforeEach("call", async function () {
          await this.setters.incrementEpochE(); // 4
          await this.setters.incrementEpochE(); // 5
          await this.setters.incrementEpochE(); // 6
          await this.setters.incrementEpochE(); // 7
          await this.setters.incrementEpochE(); // 8
          await this.setters.incrementEpochE(); // 9
          await this.setters.incrementEpochE(); // 10
        });

        it("should have unlocked user", async function () {
          expect(await this.setters.isNominated(candidate)).to.be.equal(true);
          expect(
            await this.setters.statusOf(userAddress)
          ).to.be.bignumber.equal(new BN(0));
          expect(
            await this.setters.lockedUntil(userAddress)
          ).to.be.bignumber.equal(new BN(10));
        });
      });
    });

    describe("when voting multiple reverse", function () {
      beforeEach("call", async function () {
        await this.setters.incrementEpochE(); // 2
        await this.setters.incrementEpochE(); // 3
        await this.setters.createCandidateE(ownerAddress, 7);
        await this.setters.placeLockE(userAddress, ownerAddress);
        await this.setters.placeLockE(userAddress, candidate);
      });

      describe("and not waiting", function () {
        beforeEach("call", async function () {
          await this.setters.incrementEpochE(); // 4
          await this.setters.incrementEpochE(); // 5
          await this.setters.incrementEpochE(); // 6
          await this.setters.incrementEpochE(); // 7
          await this.setters.incrementEpochE(); // 8
        });

        it("should still lock user", async function () {
          expect(await this.setters.isNominated(candidate)).to.be.equal(true);
          expect(await this.setters.isNominated(ownerAddress)).to.be.equal(
            true
          );
          expect(
            await this.setters.statusOf(userAddress)
          ).to.be.bignumber.equal(new BN(2));
          expect(
            await this.setters.lockedUntil(userAddress)
          ).to.be.bignumber.equal(new BN(10));
        });
      });

      describe("and waiting", function () {
        beforeEach("call", async function () {
          await this.setters.incrementEpochE(); // 4
          await this.setters.incrementEpochE(); // 5
          await this.setters.incrementEpochE(); // 6
          await this.setters.incrementEpochE(); // 7
          await this.setters.incrementEpochE(); // 8
          await this.setters.incrementEpochE(); // 9
          await this.setters.incrementEpochE(); // 10
        });

        it("should have unlocked user", async function () {
          expect(await this.setters.isNominated(candidate)).to.be.equal(true);
          expect(
            await this.setters.statusOf(userAddress)
          ).to.be.bignumber.equal(new BN(0));
          expect(
            await this.setters.lockedUntil(userAddress)
          ).to.be.bignumber.equal(new BN(10));
        });
      });
    });
  });

  describe("initialized", function () {
    describe("before called", function () {
      it("is not initialized", async function () {
        expect(await this.setters.isInitialized(candidate)).to.be.equal(false);
      });
    });

    describe("when called", function () {
      beforeEach("call", async function () {
        await this.setters.initializedE(candidate);
      });

      it("is initialized", async function () {
        expect(await this.setters.isInitialized(candidate)).to.be.equal(true);
      });
    });
  });
});
