const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockRegulator = contract.fromArtifact('MockRegulator');
const MockSettableOracle = contract.fromArtifact('MockSettableOracle');
const Dollar = contract.fromArtifact('Dollar');

const LEGACY_POOL_ADDRESS = "0xdF0Ae5504A48ab9f913F8490fBef1b9333A68e68";
const POOL_REWARD_PERCENT = 20;

function lessPoolIncentive(baseAmount, newAmount) {
  return new BN(baseAmount + newAmount - poolIncentive(newAmount));
}

function poolIncentive(newAmount) {
  return new BN(newAmount * POOL_REWARD_PERCENT / 100);
}

describe('Regulator', function () {
  const [ ownerAddress, userAddress, poolAddress ] = accounts;

  beforeEach(async function () {
    this.oracle = await MockSettableOracle.new({from: ownerAddress, gas: 8000000});
    this.regulator = await MockRegulator.new(this.oracle.address, poolAddress, {from: ownerAddress, gas: 8000000});
    this.dollar = await Dollar.at(await this.regulator.dollar());
  });

  describe('bootstrapping', function () {
    describe('up regulation', function () {
      describe('above limit', function () {
        beforeEach(async function () {
          await this.regulator.incrementEpochE(); // 1
          await this.regulator.incrementEpochE(); // 2
          await this.regulator.incrementTotalBondedE(1000000);
          await this.regulator.mintToE(this.regulator.address, 1000000);
        });

        describe('on step', function () {
          beforeEach(async function () {
            await this.oracle.set(115, 100, true);
            this.result = await this.regulator.stepE();
            this.txHash = this.result.tx;
          });

          it('mints new Dollar tokens', async function () {
            expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1100000));
            expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(lessPoolIncentive(1000000, 100000));
            expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(poolIncentive(100000));
          });

          it('updates totals', async function () {
            expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalBonded()).to.be.bignumber.equal(lessPoolIncentive(1000000, 100000));
            expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(0));
          });

          it('emits SupplyIncrease event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyIncrease', {});

            expect(event.args.epoch).to.be.bignumber.equal(new BN(2));
            expect(event.args.price).to.be.bignumber.equal(new BN(110).mul(new BN(10).pow(new BN(16))));
            expect(event.args.newRedeemable).to.be.bignumber.equal(new BN(0));
            expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
            expect(event.args.newBonded).to.be.bignumber.equal(new BN(100000));
          });
        });
      });

      describe('below limit', function () {
        beforeEach(async function () {
          await this.regulator.incrementEpochE(); // 1
          await this.regulator.incrementEpochE(); // 2
          await this.regulator.incrementTotalBondedE(1000000);
          await this.regulator.mintToE(this.regulator.address, 1000000);
        });

        describe('on step', function () {
          beforeEach(async function () {
            await this.oracle.set(105, 100, true);
            this.result = await this.regulator.stepE();
            this.txHash = this.result.tx;
          });

          it('mints new Dollar tokens', async function () {
            expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1100000));
            expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(lessPoolIncentive(1000000, 100000));
            expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(poolIncentive(100000));
          });

          it('updates totals', async function () {
            expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalBonded()).to.be.bignumber.equal(lessPoolIncentive(1000000, 100000));
            expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(0));
          });

          it('emits SupplyIncrease event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyIncrease', {});

            expect(event.args.epoch).to.be.bignumber.equal(new BN(2));
            expect(event.args.price).to.be.bignumber.equal(new BN(110).mul(new BN(10).pow(new BN(16))));
            expect(event.args.newRedeemable).to.be.bignumber.equal(new BN(0));
            expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
            expect(event.args.newBonded).to.be.bignumber.equal(new BN(100000));
          });
        });
      });
    });

    describe('down regulation', function () {
      describe('under limit', function () {
        beforeEach(async function () {
          await this.regulator.incrementEpochE(); // 1

          await this.regulator.incrementTotalBondedE(1000000);
          await this.regulator.mintToE(this.regulator.address, 1000000);

          await this.regulator.incrementEpochE(); // 2

        });

        describe('on step', function () {
          beforeEach(async function () {
            await this.oracle.set(85, 100, true);
            this.result = await this.regulator.stepE();
            this.txHash = this.result.tx;
          });

          it('mints new Dollar tokens', async function () {
            expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1100000));
            expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(lessPoolIncentive(1000000, 100000));
            expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(poolIncentive(100000));
          });

          it('updates totals', async function () {
            expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalBonded()).to.be.bignumber.equal(lessPoolIncentive(1000000, 100000));
            expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(0));
          });

          it('emits SupplyIncrease event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyIncrease', {});

            expect(event.args.epoch).to.be.bignumber.equal(new BN(2));
            expect(event.args.price).to.be.bignumber.equal(new BN(110).mul(new BN(10).pow(new BN(16))));
            expect(event.args.newRedeemable).to.be.bignumber.equal(new BN(0));
            expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
            expect(event.args.newBonded).to.be.bignumber.equal(new BN(100000));
          });
        });
      });

      describe('above limit', function () {
        beforeEach(async function () {
          await this.regulator.incrementEpochE(); // 1

          await this.regulator.incrementTotalBondedE(1000000);
          await this.regulator.mintToE(this.regulator.address, 1000000);

          await this.regulator.incrementEpochE(); // 2

        });

        describe('on step', function () {
          beforeEach(async function () {
            await this.oracle.set(95, 100, true);
            this.result = await this.regulator.stepE();
            this.txHash = this.result.tx;
          });

          it('mints new Dollar tokens', async function () {
            expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1100000));
            expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(lessPoolIncentive(1000000, 100000));
            expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(poolIncentive(100000));
          });

          it('updates totals', async function () {
            expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalBonded()).to.be.bignumber.equal(lessPoolIncentive(1000000, 100000));
            expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(0));
          });

          it('emits SupplyIncrease event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyIncrease', {});

            expect(event.args.epoch).to.be.bignumber.equal(new BN(2));
            expect(event.args.price).to.be.bignumber.equal(new BN(110).mul(new BN(10).pow(new BN(16))));
            expect(event.args.newRedeemable).to.be.bignumber.equal(new BN(0));
            expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
            expect(event.args.newBonded).to.be.bignumber.equal(new BN(100000));
          });
        });
      });
    });

    describe('neutral regulation', function () {
      beforeEach(async function () {
        await this.regulator.incrementEpochE(); // 1

        await this.regulator.incrementTotalBondedE(1000000);
        await this.regulator.mintToE(this.regulator.address, 1000000);

        await this.regulator.incrementEpochE(); // 2
      });

      describe('on step', function () {
        beforeEach(async function () {
          await this.oracle.set(100, 100, true);
          this.result = await this.regulator.stepE();
          this.txHash = this.result.tx;
        });

        it('mints new Dollar tokens', async function () {
          expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1100000));
          expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(lessPoolIncentive(1000000, 100000));
          expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(poolIncentive(100000));
        });

        it('updates totals', async function () {
          expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalBonded()).to.be.bignumber.equal(lessPoolIncentive(1000000, 100000));
          expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(0));
        });

        it('emits SupplyIncrease event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyIncrease', {});

          expect(event.args.epoch).to.be.bignumber.equal(new BN(2));
          expect(event.args.price).to.be.bignumber.equal(new BN(110).mul(new BN(10).pow(new BN(16))));
          expect(event.args.newRedeemable).to.be.bignumber.equal(new BN(0));
          expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
          expect(event.args.newBonded).to.be.bignumber.equal(new BN(100000));
        });
      });
    });
  });

  describe('after bootstrapped', function () {
    beforeEach(async function () {
      await this.regulator.incrementEpochE(); // 1
      await this.regulator.incrementEpochE(); // 2
      await this.regulator.incrementEpochE(); // 3
      await this.regulator.incrementEpochE(); // 4
      await this.regulator.incrementEpochE(); // 5
    });

    describe('up regulation', function () {
      describe('above limit', function () {
        beforeEach(async function () {
          await this.regulator.incrementEpochE(); // 1
          await this.regulator.incrementEpochE(); // 2
          await this.regulator.incrementTotalBondedE(1000000);
          await this.regulator.mintToE(this.regulator.address, 1000000);
        });

        describe('on step', function () {
          beforeEach(async function () {
            await this.oracle.set(115, 100, true);
            this.result = await this.regulator.stepE();
            this.txHash = this.result.tx;
          });

          it('mints new Dollar tokens', async function () {
            expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1100000));
            expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(lessPoolIncentive(1000000, 100000));
            expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(poolIncentive(100000));
          });

          it('updates totals', async function () {
            expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalBonded()).to.be.bignumber.equal(lessPoolIncentive(1000000, 100000));
            expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(0));
          });

          it('emits SupplyIncrease event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyIncrease', {});

            expect(event.args.epoch).to.be.bignumber.equal(new BN(7));
            expect(event.args.price).to.be.bignumber.equal(new BN(115).mul(new BN(10).pow(new BN(16))));
            expect(event.args.newRedeemable).to.be.bignumber.equal(new BN(0));
            expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
            expect(event.args.newBonded).to.be.bignumber.equal(new BN(100000));
          });
        });
      });

      describe('(3) - only to bonded', function () {
        beforeEach(async function () {
          await this.regulator.incrementEpochE(); // 1
          await this.regulator.incrementEpochE(); // 2
          await this.regulator.incrementTotalBondedE(1000000);
          await this.regulator.mintToE(this.regulator.address, 1000000);
        });

        describe('on step', function () {
          beforeEach(async function () {
            await this.oracle.set(105, 100, true);
            this.result = await this.regulator.stepE();
            this.txHash = this.result.tx;
          });

          it('mints new Dollar tokens', async function () {
            expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1050000));
            expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(lessPoolIncentive(1000000, 50000));
            expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(poolIncentive(50000));
          });

          it('updates totals', async function () {
            expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalBonded()).to.be.bignumber.equal(lessPoolIncentive(1000000, 50000));
            expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(0));
          });

          it('emits SupplyIncrease event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyIncrease', {});

            expect(event.args.epoch).to.be.bignumber.equal(new BN(7));
            expect(event.args.price).to.be.bignumber.equal(new BN(105).mul(new BN(10).pow(new BN(16))));
            expect(event.args.newRedeemable).to.be.bignumber.equal(new BN(0));
            expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
            expect(event.args.newBonded).to.be.bignumber.equal(new BN(50000));
          });
        });
      });

      describe('(2) - only to repay debt', function () {
        beforeEach(async function () {
          await this.regulator.incrementEpochE(); // 1
          await this.regulator.incrementEpochE(); // 2

          await this.regulator.incrementTotalBondedE(1000000);
          await this.regulator.mintToE(this.regulator.address, 1000000);

          await this.regulator.increaseDebtE(new BN(100000));
        });

        describe('on step', function () {
          beforeEach(async function () {
            await this.oracle.set(105, 100, true);
            this.result = await this.regulator.stepE();
            this.txHash = this.result.tx;
          });

          it('doesnt mint new Dollar tokens', async function () {
            expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1000000));
            expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(new BN(1000000));
            expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.dollar.balanceOf(LEGACY_POOL_ADDRESS)).to.be.bignumber.equal(new BN(0));
          });

          it('updates totals', async function () {
            expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalBonded()).to.be.bignumber.equal(new BN(1000000));
            expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(55000));
            expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(0));
          });

          it('emits SupplyIncrease event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyIncrease', {});

            expect(event.args.epoch).to.be.bignumber.equal(new BN(7));
            expect(event.args.price).to.be.bignumber.equal(new BN(105).mul(new BN(10).pow(new BN(16))));
            expect(event.args.newRedeemable).to.be.bignumber.equal(new BN(0));
            expect(event.args.lessDebt).to.be.bignumber.equal(new BN(45000));
            expect(event.args.newBonded).to.be.bignumber.equal(new BN(0));
          });
        });
      });

      describe('(1) - only refresh redeemable debt', function () {
        beforeEach(async function () {
          await this.regulator.incrementEpochE(); // 1

          await this.regulator.incrementTotalBondedE(1000000);
          await this.regulator.mintToE(this.regulator.address, 1000000);

          await this.regulator.incrementBalanceOfCouponsE(userAddress, 1, new BN(100000));

          await this.regulator.incrementEpochE(); // 2
        });

        describe('on step', function () {
          beforeEach(async function () {
            await this.oracle.set(105, 100, true);
            this.result = await this.regulator.stepE();
            this.txHash = this.result.tx;
          });

          it('mints new Dollar tokens', async function () {
            expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1050000));
            expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(new BN(1050000));
            expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.dollar.balanceOf(LEGACY_POOL_ADDRESS)).to.be.bignumber.equal(new BN(0));
          });

          it('updates totals', async function () {
            expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalBonded()).to.be.bignumber.equal(new BN(1000000));
            expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(100000));
            expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(50000));
          });

          it('emits SupplyIncrease event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyIncrease', {});

            expect(event.args.epoch).to.be.bignumber.equal(new BN(7));
            expect(event.args.price).to.be.bignumber.equal(new BN(105).mul(new BN(10).pow(new BN(16))));
            expect(event.args.newRedeemable).to.be.bignumber.equal(new BN(50000));
            expect(event.args.lessDebt).to.be.bignumber.equal(new BN(0));
            expect(event.args.newBonded).to.be.bignumber.equal(new BN(0));
          });
        });
      });
    });

    describe('(2 + 3) - repay debt then mint to bonded', function () {
      beforeEach(async function () {
        await this.regulator.incrementEpochE(); // 1
        await this.regulator.incrementEpochE(); // 2

        await this.regulator.incrementTotalBondedE(1000000);
        await this.regulator.mintToE(this.regulator.address, 1000000);

        await this.regulator.increaseDebtE(new BN(10000));
      });

      describe('on step', function () {
        beforeEach(async function () {
          await this.oracle.set(105, 100, true);
          this.result = await this.regulator.stepE();
          this.txHash = this.result.tx;
        });

        it('mints new Dollar tokens', async function () {
          expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1039500));
          expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(lessPoolIncentive(1000000, 39500));
          expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(poolIncentive(39500));
        });

        it('updates totals', async function () {
          expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalBonded()).to.be.bignumber.equal(lessPoolIncentive(1000000, 39500));
          expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(0));
        });

        it('emits SupplyIncrease event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyIncrease', {});

          expect(event.args.epoch).to.be.bignumber.equal(new BN(7));
          expect(event.args.price).to.be.bignumber.equal(new BN(105).mul(new BN(10).pow(new BN(16))));
          expect(event.args.newRedeemable).to.be.bignumber.equal(new BN(0));
          expect(event.args.lessDebt).to.be.bignumber.equal(new BN(10000));
          expect(event.args.newBonded).to.be.bignumber.equal(new BN(39500));
        });
      });
    });

    describe('(1 + 2) - refresh redeemable then repay debt', function () {
      beforeEach(async function () {
        await this.regulator.incrementEpochE(); // 1

        await this.regulator.incrementTotalBondedE(1000000);
        await this.regulator.mintToE(this.regulator.address, 1000000);

        await this.regulator.increaseDebtE(new BN(100000));
        await this.regulator.incrementBalanceOfCouponsE(userAddress, 1, new BN(10000));

        await this.regulator.incrementEpochE(); // 2

      });

      describe('on step', function () {
        beforeEach(async function () {
          await this.oracle.set(105, 100, true);
          this.result = await this.regulator.stepE();
          this.txHash = this.result.tx;
        });

        it('mints new Dollar tokens', async function () {
          expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1010000));
          expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(new BN(1010000));
          expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.dollar.balanceOf(LEGACY_POOL_ADDRESS)).to.be.bignumber.equal(new BN(0));
        });

        it('updates totals', async function () {
          expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalBonded()).to.be.bignumber.equal(new BN(1000000));
          expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(65000));
          expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(10000));
          expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(10000));
        });

        it('emits SupplyIncrease event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyIncrease', {});

          expect(event.args.epoch).to.be.bignumber.equal(new BN(7));
          expect(event.args.price).to.be.bignumber.equal(new BN(105).mul(new BN(10).pow(new BN(16))));
          expect(event.args.newRedeemable).to.be.bignumber.equal(new BN(10000));
          expect(event.args.lessDebt).to.be.bignumber.equal(new BN(35000));
          expect(event.args.newBonded).to.be.bignumber.equal(new BN(0));
        });
      });
    });

    describe('(1 + 2 + 3) - refresh redeemable then repay debt then mint to bonded', function () {
      beforeEach(async function () {
        await this.regulator.incrementEpochE(); // 1

        await this.regulator.incrementTotalBondedE(1000000);
        await this.regulator.mintToE(this.regulator.address, 1000000);

        await this.regulator.increaseDebtE(new BN(10000));
        await this.regulator.incrementBalanceOfCouponsE(userAddress, 1, new BN(10000));

        await this.regulator.incrementEpochE(); // 2

      });

      describe('on step', function () {
        beforeEach(async function () {
          await this.oracle.set(105, 100, true);
          this.result = await this.regulator.stepE();
          this.txHash = this.result.tx;
        });

        it('mints new Dollar tokens', async function () {
          expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1039500));
          expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(lessPoolIncentive(1010000, 29500));
          expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(poolIncentive(29500));
        });

        it('updates totals', async function () {
          expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalBonded()).to.be.bignumber.equal(lessPoolIncentive(1000000, 29500));
          expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(10000));
          expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(10000));
        });

        it('emits SupplyIncrease event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyIncrease', {});

          expect(event.args.epoch).to.be.bignumber.equal(new BN(7));
          expect(event.args.price).to.be.bignumber.equal(new BN(105).mul(new BN(10).pow(new BN(16))));
          expect(event.args.newRedeemable).to.be.bignumber.equal(new BN(10000));
          expect(event.args.lessDebt).to.be.bignumber.equal(new BN(10000));
          expect(event.args.newBonded).to.be.bignumber.equal(new BN(29500));
        });
      });
    });

    describe('down regulation', function () {
      describe('under limit', function () {
        beforeEach(async function () {
          await this.regulator.incrementEpochE(); // 1
          await this.regulator.incrementEpochE(); // 2

          await this.regulator.incrementTotalBondedE(1000000);
          await this.regulator.mintToE(this.regulator.address, 1000000);

          await this.regulator.incrementEpochE(); // 3
        });

        describe('on step', function () {
          beforeEach(async function () {
            await this.oracle.set(85, 100, true);
            this.result = await this.regulator.stepE();
            this.txHash = this.result.tx;
          });

          it('doesnt mint new Dollar tokens', async function () {
            expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1000000));
            expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(new BN(1000000));
            expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.dollar.balanceOf(LEGACY_POOL_ADDRESS)).to.be.bignumber.equal(new BN(0));
          });

          it('updates totals', async function () {
            expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalBonded()).to.be.bignumber.equal(new BN(1000000));
            expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(100000));
            expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(0));
          });

          it('emits SupplyDecrease event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyDecrease', {});

            expect(event.args.epoch).to.be.bignumber.equal(new BN(8));
            expect(event.args.price).to.be.bignumber.equal(new BN(85).mul(new BN(10).pow(new BN(16))));
            expect(event.args.newDebt).to.be.bignumber.equal(new BN(100000));
          });
        });
      });

      describe('without debt', function () {
        beforeEach(async function () {
          await this.regulator.incrementEpochE(); // 1

          await this.regulator.incrementTotalBondedE(1000000);
          await this.regulator.mintToE(this.regulator.address, 1000000);

          await this.regulator.incrementEpochE(); // 2

        });

        describe('on step', function () {
          beforeEach(async function () {
            await this.oracle.set(95, 100, true);
            this.result = await this.regulator.stepE();
            this.txHash = this.result.tx;
          });

          it('doesnt mint new Dollar tokens', async function () {
            expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1000000));
            expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(new BN(1000000));
            expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.dollar.balanceOf(LEGACY_POOL_ADDRESS)).to.be.bignumber.equal(new BN(0));
          });

          it('updates totals', async function () {
            expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalBonded()).to.be.bignumber.equal(new BN(1000000));
            expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(50000));
            expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(0));
            expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(0));
          });

          it('emits SupplyDecrease event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyDecrease', {});

            expect(event.args.epoch).to.be.bignumber.equal(new BN(7));
            expect(event.args.price).to.be.bignumber.equal(new BN(95).mul(new BN(10).pow(new BN(16))));
            expect(event.args.newDebt).to.be.bignumber.equal(new BN(50000));
          });
        });
      });

      describe('with debt', function () {
        beforeEach(async function () {
          await this.regulator.incrementEpochE(); // 1

          await this.regulator.incrementTotalBondedE(1000000);
          await this.regulator.mintToE(this.regulator.address, 1000000);

          await this.regulator.increaseDebtE(new BN(100000));

          await this.regulator.incrementEpochE(); // 2
        });

        describe('on step', function () {
          beforeEach(async function () {
            await this.oracle.set(95, 100, true);
            this.result = await this.regulator.stepE();
            this.txHash = this.result.tx;
          });

          it('doesnt mint new Dollar tokens', async function () {
            expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1000000));
            expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(new BN(1000000));
            expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.dollar.balanceOf(LEGACY_POOL_ADDRESS)).to.be.bignumber.equal(new BN(0));
          });

          it('updates totals', async function () {
            it('updates totals', async function () {
              expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
              expect(await this.regulator.totalBonded()).to.be.bignumber.equal(new BN(1000000));
              expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(145000));
              expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
              expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(0));
              expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(0));
            });
          });

          it('emits SupplyDecrease event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyDecrease', {});

            expect(event.args.epoch).to.be.bignumber.equal(new BN(7));
            expect(event.args.price).to.be.bignumber.equal(new BN(95).mul(new BN(10).pow(new BN(16))));
            expect(event.args.newDebt).to.be.bignumber.equal(new BN(45000));
          });
        });
      });
    });

    describe('neutral regulation', function () {
      beforeEach(async function () {
        await this.regulator.incrementEpochE(); // 1

        await this.regulator.incrementTotalBondedE(1000000);
        await this.regulator.mintToE(this.regulator.address, 1000000);

        await this.regulator.incrementEpochE(); // 2

      });

      describe('on step', function () {
        beforeEach(async function () {
          await this.oracle.set(100, 100, true);
          this.result = await this.regulator.stepE();
          this.txHash = this.result.tx;
        });

        it('doesnt mint new Dollar tokens', async function () {
          expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1000000));
          expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(new BN(1000000));
          expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.dollar.balanceOf(LEGACY_POOL_ADDRESS)).to.be.bignumber.equal(new BN(0));
        });

        it('updates totals', async function () {
          expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalBonded()).to.be.bignumber.equal(new BN(1000000));
          expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(0));
        });

        it('emits SupplyNeutral event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyNeutral', {});

          expect(event.args.epoch).to.be.bignumber.equal(new BN(7));
        });
      });
    });

    describe('not valid', function () {
      beforeEach(async function () {
        await this.regulator.incrementEpochE(); // 1

        await this.regulator.incrementTotalBondedE(1000000);
        await this.regulator.mintToE(this.regulator.address, 1000000);

        await this.regulator.incrementEpochE(); // 2

      });

      describe('on step', function () {
        beforeEach(async function () {
          await this.oracle.set(105, 100, false);
          this.result = await this.regulator.stepE();
          this.txHash = this.result.tx;
        });

        it('doesnt mint new Dollar tokens', async function () {
          expect(await this.dollar.totalSupply()).to.be.bignumber.equal(new BN(1000000));
          expect(await this.dollar.balanceOf(this.regulator.address)).to.be.bignumber.equal(new BN(1000000));
          expect(await this.dollar.balanceOf(poolAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.dollar.balanceOf(LEGACY_POOL_ADDRESS)).to.be.bignumber.equal(new BN(0));
        });

        it('updates totals', async function () {
          expect(await this.regulator.totalStaged()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalBonded()).to.be.bignumber.equal(new BN(1000000));
          expect(await this.regulator.totalDebt()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalSupply()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalCoupons()).to.be.bignumber.equal(new BN(0));
          expect(await this.regulator.totalRedeemable()).to.be.bignumber.equal(new BN(0));
        });

        it('emits SupplyNeutral event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockRegulator, 'SupplyNeutral', {});

          expect(event.args.epoch).to.be.bignumber.equal(new BN(7));
        });
      });
    });
  });
});