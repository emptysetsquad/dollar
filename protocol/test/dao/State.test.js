const { accounts, contract } = require("@openzeppelin/test-environment");

const { BN, expectRevert } = require("@openzeppelin/test-helpers");
const { expect } = require("chai");

const MockState = contract.fromArtifact("MockState");

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
    beforeEach(async function () {
      await this.setters.incrementEpochE();
    });

    it("equals epoch()", async function () {
      expect(await this.setters.epochTime()).to.be.bignumber.equal(new BN(1));
    });
  });

  /**
   * Governance
   */
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
