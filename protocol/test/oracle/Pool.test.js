const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockPool = contract.fromArtifact('MockPool');
const MockToken = contract.fromArtifact('MockToken');
const MockUniswapV2PairLiquidity = contract.fromArtifact('MockUniswapV2PairLiquidity');
const MockSettableDAO = contract.fromArtifact('MockSettableDAO');

const INITIAL_STAKE_MULTIPLE = new BN(10).pow(new BN(6)); // 100 ESD -> 100M ESDS

const FROZEN = new BN(0);
const FLUID = new BN(1);

async function incrementEpoch(dao) {
  await dao.set((await dao.epoch()).toNumber() + 1);
}

describe('Pool', function () {
  const [ ownerAddress, userAddress, userAddress1, userAddress2, mockDao ] = accounts;

  beforeEach(async function () {
    this.dao = await MockSettableDAO.new({from: ownerAddress, gas: 8000000});
    await this.dao.set(1);
    this.dollar = await MockToken.new("Empty Set Dollar", "ESD", 18, {from: ownerAddress, gas: 8000000});
    this.usdc = await MockToken.new("USD//C", "USDC", 18, {from: ownerAddress, gas: 8000000});
    this.univ2 = await MockUniswapV2PairLiquidity.new({from: ownerAddress, gas: 8000000});
    this.pool = await MockPool.new(this.usdc.address, {from: ownerAddress, gas: 8000000});
    await this.pool.set(this.dao.address, this.dollar.address, this.univ2.address);
  });

  describe('frozen', function () {
    describe('starts as frozen', function () {
      it('mints new Dollar tokens', async function () {
        expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FROZEN);
      });
    });

    describe('when deposit', function () {
      beforeEach(async function () {
        await this.univ2.faucet(userAddress, 1000);
        await this.univ2.approve(this.pool.address, 1000, {from: userAddress});

        this.result = await this.pool.deposit(1000, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('is frozen', async function () {
        expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FROZEN);
      });

      it('updates users balances', async function () {
        expect(await this.univ2.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.pool.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(1000));
        expect(await this.pool.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(0));
      });

      it('updates dao balances', async function () {
        expect(await this.univ2.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(1000));
        expect(await this.pool.totalBonded()).to.be.bignumber.equal(new BN(0));
        expect(await this.pool.totalStaged()).to.be.bignumber.equal(new BN(1000));
      });

      it('emits Deposit event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Deposit', {
          account: userAddress
        });

        expect(event.args.value).to.be.bignumber.equal(new BN(1000));
      });
    });

    describe('when withdraw', function () {
      describe('simple', function () {
        beforeEach(async function () {
          await this.univ2.faucet(userAddress, 1000);
          await this.univ2.approve(this.pool.address, 1000, {from: userAddress});
          await this.pool.deposit(1000, {from: userAddress});

          this.result = await this.pool.withdraw(1000, {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('is frozen', async function () {
          expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FROZEN);
        });

        it('updates users balances', async function () {
          expect(await this.univ2.balanceOf(userAddress)).to.be.bignumber.equal(new BN(1000));
          expect(await this.pool.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(0));
        });

        it('updates dao balances', async function () {
          expect(await this.univ2.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.totalBonded()).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.totalStaged()).to.be.bignumber.equal(new BN(0));
        });

        it('emits Withdraw event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Withdraw', {
            account: userAddress
          });

          expect(event.args.value).to.be.bignumber.equal(new BN(1000));
        });
      });

      describe('too much', function () {
        beforeEach(async function () {
          await this.univ2.faucet(userAddress, 1000);
          await this.univ2.approve(this.pool.address, 1000, {from: userAddress});
          await this.pool.deposit(1000, {from: userAddress});

          await this.univ2.faucet(userAddress1, 10000);
          await this.univ2.approve(this.pool.address, 10000, {from: userAddress1});
          await this.pool.deposit(10000, {from: userAddress1});
        });

        it('reverts', async function () {
          await expectRevert(this.pool.withdraw(2000, {from: userAddress}), "insufficient staged balance");
        });
      });
    });

    describe('when claim', function () {
      beforeEach(async function () {
        await this.univ2.faucet(userAddress, 1000);
        await this.univ2.approve(this.pool.address, 1000, {from: userAddress});
        await this.pool.deposit(1000, {from: userAddress});
        await this.pool.bond(1000, {from: userAddress});
        await this.dao.set((await this.dao.epoch()) + 1);
        await this.dollar.mint(this.pool.address, 1000);
        await this.pool.unbond(1000, {from: userAddress});
        await this.dao.set((await this.dao.epoch()) + 1);
      });

      describe('simple', function () {
        beforeEach(async function () {
          this.result = await this.pool.claim(1000, {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('is frozen', async function () {
          expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FROZEN);
        });

        it('updates users balances', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(1000));
          expect(await this.pool.balanceOfClaimable(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.balanceOfRewarded(userAddress)).to.be.bignumber.equal(new BN(0));
        });

        it('updates dao balances', async function () {
          expect(await this.dollar.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.totalClaimable()).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.totalRewarded()).to.be.bignumber.equal(new BN(0));
        });

        it('emits Claim event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Claim', {
            account: userAddress
          });

          expect(event.args.value).to.be.bignumber.equal(new BN(1000));
        });
      });

      describe('too much', function () {
        beforeEach(async function () {
          await this.dollar.mint(this.pool.address, 1000);
        });

        it('reverts', async function () {
          await expectRevert(this.pool.claim(2000, {from: userAddress}), "insufficient claimable balance");
        });
      });
    });

    describe('when bond', function () {
      describe('no reward', function () {
        describe('simple', function () {
          beforeEach(async function () {
            await this.univ2.faucet(userAddress, 1000);
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress});
            await this.pool.deposit(1000, {from: userAddress});

            this.result = await this.pool.bond(1000, {from: userAddress});
            this.txHash = this.result.tx;
          });

          it('is fluid', async function () {
            expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
          });

          it('updates users balances', async function () {
            expect(await this.univ2.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(1000));
          });

          it('updates dao balances', async function () {
            expect(await this.univ2.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(1000));
            expect(await this.pool.totalBonded()).to.be.bignumber.equal(new BN(1000));
            expect(await this.pool.totalStaged()).to.be.bignumber.equal(new BN(0));
          });

          it('emits Bond event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Bond', {
              account: userAddress
            });

            expect(event.args.start).to.be.bignumber.equal(new BN(2));
            expect(event.args.value).to.be.bignumber.equal(new BN(1000));
          });
        });

        describe('partial', function () {
          beforeEach(async function () {
            await this.univ2.faucet(userAddress, 1000);
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress});
            await this.pool.deposit(800, {from: userAddress});

            this.result = await this.pool.bond(500, {from: userAddress});
            this.txHash = this.result.tx;
          });

          it('is fluid', async function () {
            expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
          });

          it('updates users balances', async function () {
            expect(await this.univ2.balanceOf(userAddress)).to.be.bignumber.equal(new BN(200));
            expect(await this.pool.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(300));
            expect(await this.pool.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(500));
          });

          it('updates dao balances', async function () {
            expect(await this.univ2.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(800));
            expect(await this.pool.totalBonded()).to.be.bignumber.equal(new BN(500));
            expect(await this.pool.totalStaged()).to.be.bignumber.equal(new BN(300));
          });

          it('emits Bond event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Bond', {
              account: userAddress
            });

            expect(event.args.start).to.be.bignumber.equal(new BN(2));
            expect(event.args.value).to.be.bignumber.equal(new BN(500));
          });
        });

        describe('multiple', function () {
          beforeEach(async function () {
            await this.univ2.faucet(userAddress1, 1000);
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress1});
            await this.pool.deposit(1000, {from: userAddress1});

            await this.univ2.faucet(userAddress2, 1000);
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress2});
            await this.pool.deposit(1000, {from: userAddress2});

            await this.pool.bond(600, {from: userAddress1});
            await this.pool.bond(400, {from: userAddress2});

            await incrementEpoch(this.dao);

            await this.univ2.faucet(userAddress, 1000);
            await this.univ2.approve(this.pool.address, 800, {from: userAddress});
            await this.pool.deposit(800, {from: userAddress});

            this.result = await this.pool.bond(500, {from: userAddress});
            this.txHash = this.result.tx;
          });

          it('is frozen', async function () {
            expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
          });

          it('updates users balances', async function () {
            expect(await this.univ2.balanceOf(userAddress)).to.be.bignumber.equal(new BN(200));
            expect(await this.pool.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(300));
            expect(await this.pool.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(500));
          });

          it('updates dao balances', async function () {
            expect(await this.univ2.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(2800));
            expect(await this.pool.totalBonded()).to.be.bignumber.equal(new BN(1500));
            expect(await this.pool.totalStaged()).to.be.bignumber.equal(new BN(1300));
          });

          it('emits Bond event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Bond', {
              account: userAddress
            });

            expect(event.args.start).to.be.bignumber.equal(new BN(3));
            expect(event.args.value).to.be.bignumber.equal(new BN(500));
          });
        });
      });

      describe('with reward', function () {
        describe('before bonding', function () {
          beforeEach(async function () {
            await this.univ2.faucet(userAddress, 1000);
            await this.dollar.mint(this.pool.address, 1000);
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress});
            await this.pool.deposit(1000, {from: userAddress});

            this.result = await this.pool.bond(1000, {from: userAddress});
            this.txHash = this.result.tx;
          });

          it('is fluid', async function () {
            expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
          });

          it('updates users balances', async function () {
            expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfClaimable(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfRewarded(userAddress)).to.be.bignumber.equal(new BN(1000));
          });

          it('updates dao balances', async function () {
            expect(await this.dollar.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(1000));
            expect(await this.pool.totalClaimable()).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.totalRewarded()).to.be.bignumber.equal(new BN(1000));
          });

          it('emits Bond event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Bond', {
              account: userAddress
            });

            expect(event.args.start).to.be.bignumber.equal(new BN(2));
            expect(event.args.value).to.be.bignumber.equal(new BN(1000));
          });
        });

        describe('after bond', function () {
          beforeEach(async function () {
            await this.univ2.faucet(userAddress, 1000);
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress});
            await this.pool.deposit(800, {from: userAddress});

            this.result = await this.pool.bond(500, {from: userAddress});
            this.txHash = this.result.tx;

            await this.dollar.mint(this.pool.address, 1000);
          });

          it('is fluid', async function () {
            expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
          });

          it('updates users balances', async function () {
            expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfClaimable(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfRewarded(userAddress)).to.be.bignumber.equal(new BN(1000));
          });

          it('updates dao balances', async function () {
            expect(await this.dollar.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(1000));
            expect(await this.pool.totalClaimable()).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.totalRewarded()).to.be.bignumber.equal(new BN(1000));
          });

          it('emits Bond event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Bond', {
              account: userAddress
            });

            expect(event.args.start).to.be.bignumber.equal(new BN(2));
            expect(event.args.value).to.be.bignumber.equal(new BN(500));
          });
        });

        describe('multiple with reward first', function () {
          beforeEach(async function () {
            await this.univ2.faucet(userAddress1, 1000);
            await this.dollar.mint(this.pool.address, new BN(1000));
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress1});
            await this.pool.deposit(1000, {from: userAddress1});

            await this.univ2.faucet(userAddress2, 1000);
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress2});
            await this.pool.deposit(1000, {from: userAddress2});

            await this.pool.bond(600, {from: userAddress1});
            await this.pool.bond(400, {from: userAddress2});

            await incrementEpoch(this.dao);
            await this.dollar.mint(this.pool.address, new BN(1000));

            await this.univ2.faucet(userAddress, 1000);
            await this.univ2.approve(this.pool.address, 800, {from: userAddress});
            await this.pool.deposit(800, {from: userAddress});

            this.result = await this.pool.bond(500, {from: userAddress});
            this.txHash = this.result.tx;
          });

          it('is frozen', async function () {
            expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
          });

          it('updates users balances', async function () {
            expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfRewarded(userAddress1)).to.be.bignumber.equal(new BN(1599));
            expect(await this.pool.balanceOfPhantom(userAddress1)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfRewarded(userAddress2)).to.be.bignumber.equal(new BN(400));
            expect(await this.pool.balanceOfPhantom(userAddress2)).to.be.bignumber.equal(new BN(666));
            expect(await this.pool.balanceOfRewarded(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfPhantom(userAddress)).to.be.bignumber.equal(new BN(1333));
          });

          it('updates dao balances', async function () {
            expect(await this.dollar.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(2000));
            expect(await this.pool.totalRewarded()).to.be.bignumber.equal(new BN(2000));
            expect(await this.pool.totalPhantom()).to.be.bignumber.equal(new BN(1999));
          });

          it('emits Bond event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Bond', {
              account: userAddress
            });

            expect(event.args.start).to.be.bignumber.equal(new BN(3));
            expect(event.args.value).to.be.bignumber.equal(new BN(500));
          });
        });

        describe('multiple without reward first', function () {
          beforeEach(async function () {
            await this.univ2.faucet(userAddress1, 1000);
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress1});
            await this.pool.deposit(1000, {from: userAddress1});

            await this.univ2.faucet(userAddress2, 1000);
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress2});
            await this.pool.deposit(1000, {from: userAddress2});

            await this.pool.bond(600, {from: userAddress1});
            await this.pool.bond(400, {from: userAddress2});

            await incrementEpoch(this.dao);
            await this.dollar.mint(this.pool.address, new BN(1000).mul(INITIAL_STAKE_MULTIPLE));

            await this.univ2.faucet(userAddress, 1000);
            await this.univ2.approve(this.pool.address, 800, {from: userAddress});
            await this.pool.deposit(800, {from: userAddress});

            this.result = await this.pool.bond(500, {from: userAddress});
            this.txHash = this.result.tx;
          });

          it('is frozen', async function () {
            expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
          });

          it('updates users balances', async function () {
            expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfRewarded(userAddress1)).to.be.bignumber.equal(new BN(600).mul(INITIAL_STAKE_MULTIPLE));
            expect(await this.pool.balanceOfPhantom(userAddress1)).to.be.bignumber.equal(new BN(600).mul(INITIAL_STAKE_MULTIPLE));
            expect(await this.pool.balanceOfRewarded(userAddress2)).to.be.bignumber.equal(new BN(400).mul(INITIAL_STAKE_MULTIPLE));
            expect(await this.pool.balanceOfPhantom(userAddress2)).to.be.bignumber.equal(new BN(400).mul(INITIAL_STAKE_MULTIPLE));
            expect(await this.pool.balanceOfRewarded(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfPhantom(userAddress)).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
          });

          it('updates dao balances', async function () {
            expect(await this.dollar.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
            expect(await this.pool.totalRewarded()).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
            expect(await this.pool.totalPhantom()).to.be.bignumber.equal(new BN(2000).mul(INITIAL_STAKE_MULTIPLE));
          });

          it('emits Bond event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Bond', {
              account: userAddress
            });

            expect(event.args.start).to.be.bignumber.equal(new BN(3));
            expect(event.args.value).to.be.bignumber.equal(new BN(500));
          });
        });
      });
    });

    describe('when unbond', function () {
      describe('without reward', function () {
        beforeEach(async function () {
          await this.univ2.faucet(userAddress, 1000);
          await this.univ2.approve(this.pool.address, 1000, {from: userAddress});
          await this.pool.deposit(1000, {from: userAddress});

          await this.pool.bond(1000, {from: userAddress});
          await incrementEpoch(this.dao);
        });

        describe('simple', function () {
          beforeEach(async function () {
            this.result = await this.pool.unbond(new BN(1000), {from: userAddress});
            this.txHash = this.result.tx;
          });

          it('is fluid', async function () {
            expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
          });

          it('updates users balances', async function () {
            expect(await this.univ2.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(1000));
            expect(await this.pool.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(0));
          });

          it('updates dao balances', async function () {
            expect(await this.univ2.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(1000));
            expect(await this.pool.totalBonded()).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.totalStaged()).to.be.bignumber.equal(new BN(1000));
          });

          it('emits Unbond event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Unbond', {
              account: userAddress
            });

            expect(event.args.start).to.be.bignumber.equal(new BN(3));
            expect(event.args.value).to.be.bignumber.equal(new BN(1000));
            expect(event.args.newClaimable).to.be.bignumber.equal(new BN(0));
          });
        });

        describe('partial', function () {
          beforeEach(async function () {
            this.result = await this.pool.unbond(new BN(800), {from: userAddress});
            this.txHash = this.result.tx;
          });

          it('is fluid', async function () {
            expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
          });

          it('updates users balances', async function () {
            expect(await this.univ2.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(800));
            expect(await this.pool.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(200));
          });

          it('updates dao balances', async function () {
            expect(await this.univ2.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(1000));
            expect(await this.pool.totalBonded()).to.be.bignumber.equal(new BN(200));
            expect(await this.pool.totalStaged()).to.be.bignumber.equal(new BN(800));
          });

          it('emits Unbond event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Unbond', {
              account: userAddress
            });

            expect(event.args.start).to.be.bignumber.equal(new BN(3));
            expect(event.args.value).to.be.bignumber.equal(new BN(800));
            expect(event.args.newClaimable).to.be.bignumber.equal(new BN(0));
          });
        });

        describe('multiple', function () {
          beforeEach(async function () {
            await this.univ2.faucet(userAddress1, 1000);
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress1});
            await this.pool.deposit(1000, {from: userAddress1});

            await this.univ2.faucet(userAddress2, 1000);
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress2});
            await this.pool.deposit(1000, {from: userAddress2});

            await this.pool.bond(600, {from: userAddress1});
            await this.pool.bond(400, {from: userAddress2});

            await incrementEpoch(this.dao);

            this.result = await this.pool.unbond(new BN(800), {from: userAddress});
            this.txHash = this.result.tx;
          });

          it('is frozen', async function () {
            expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
          });

          it('updates users balances', async function () {
            expect(await this.univ2.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(800));
            expect(await this.pool.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(200));
          });

          it('updates dao balances', async function () {
            expect(await this.univ2.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(3000));
            expect(await this.pool.totalBonded()).to.be.bignumber.equal(new BN(1200));
            expect(await this.pool.totalStaged()).to.be.bignumber.equal(new BN(1800));
          });

          it('emits Unbond event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Unbond', {
              account: userAddress
            });

            expect(event.args.start).to.be.bignumber.equal(new BN(4));
            expect(event.args.value).to.be.bignumber.equal(new BN(800));
            expect(event.args.newClaimable).to.be.bignumber.equal(new BN(0));
          });
        });
      });

      describe('with reward', function () {
        beforeEach(async function () {
          await this.univ2.faucet(userAddress, 1000);
          await this.univ2.approve(this.pool.address, 1000, {from: userAddress});
          await this.pool.deposit(1000, {from: userAddress});

          await this.pool.bond(1000, {from: userAddress});
          await incrementEpoch(this.dao);
          await this.dollar.mint(this.pool.address, 1000);
        });

        describe('simple', function () {
          beforeEach(async function () {
            this.result = await this.pool.unbond(new BN(1000), {from: userAddress});
            this.txHash = this.result.tx;
          });

          it('is fluid', async function () {
            expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
          });

          it('updates users balances', async function () {
            expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfClaimable(userAddress)).to.be.bignumber.equal(new BN(1000));
            expect(await this.pool.balanceOfRewarded(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfPhantom(userAddress)).to.be.bignumber.equal(new BN(0));
          });

          it('updates dao balances', async function () {
            expect(await this.dollar.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(1000));
            expect(await this.pool.totalClaimable()).to.be.bignumber.equal(new BN(1000));
            expect(await this.pool.totalRewarded()).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.totalPhantom()).to.be.bignumber.equal(new BN(0));
          });

          it('emits Unbond event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Unbond', {
              account: userAddress
            });

            expect(event.args.start).to.be.bignumber.equal(new BN(3));
            expect(event.args.value).to.be.bignumber.equal(new BN(1000));
            expect(event.args.newClaimable).to.be.bignumber.equal(new BN(1000));
          });
        });

        describe('partial', function () {
          beforeEach(async function () {
            this.result = await this.pool.unbond(new BN(800), {from: userAddress});
            this.txHash = this.result.tx;
          });

          it('is fluid', async function () {
            expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
          });

          it('updates users balances', async function () {
            expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfClaimable(userAddress)).to.be.bignumber.equal(new BN(800));
            expect(await this.pool.balanceOfRewarded(userAddress)).to.be.bignumber.equal(new BN(200));
            expect(await this.pool.balanceOfPhantom(userAddress)).to.be.bignumber.equal(new BN(200).mul(INITIAL_STAKE_MULTIPLE));
          });

          it('updates dao balances', async function () {
            expect(await this.dollar.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(1000));
            expect(await this.pool.totalClaimable()).to.be.bignumber.equal(new BN(800));
            expect(await this.pool.totalRewarded()).to.be.bignumber.equal(new BN(200));
            expect(await this.pool.totalPhantom()).to.be.bignumber.equal(new BN(200).mul(INITIAL_STAKE_MULTIPLE));
          });

          it('emits Unbond event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Unbond', {
              account: userAddress
            });

            expect(event.args.start).to.be.bignumber.equal(new BN(3));
            expect(event.args.value).to.be.bignumber.equal(new BN(800));
            expect(event.args.newClaimable).to.be.bignumber.equal(new BN(800));
          });
        });

        describe('multiple', function () {
          beforeEach(async function () {
            await this.univ2.faucet(userAddress1, 1000);
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress1});
            await this.pool.deposit(1000, {from: userAddress1});

            await this.univ2.faucet(userAddress2, 1000);
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress2});
            await this.pool.deposit(1000, {from: userAddress2});

            await this.pool.bond(600, {from: userAddress1});
            await this.pool.bond(400, {from: userAddress2});

            await incrementEpoch(this.dao);
            await this.dollar.mint(this.pool.address, 1000);

            this.result = await this.pool.unbond(new BN(800), {from: userAddress});
            this.txHash = this.result.tx;
          });

          it('is frozen', async function () {
            expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
          });

          it('updates users balances', async function () {
            expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfClaimable(userAddress)).to.be.bignumber.equal(new BN(1200));
            expect(await this.pool.balanceOfRewarded(userAddress)).to.be.bignumber.equal(new BN(300));
            expect(await this.pool.balanceOfPhantom(userAddress)).to.be.bignumber.equal(new BN(200).mul(INITIAL_STAKE_MULTIPLE));
            expect(await this.pool.balanceOfClaimable(userAddress1)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfRewarded(userAddress1)).to.be.bignumber.equal(new BN(300));
            expect(await this.pool.balanceOfPhantom(userAddress1)).to.be.bignumber.equal(new BN(600).mul(INITIAL_STAKE_MULTIPLE).addn(600));
            expect(await this.pool.balanceOfClaimable(userAddress2)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfRewarded(userAddress2)).to.be.bignumber.equal(new BN(200));
            expect(await this.pool.balanceOfPhantom(userAddress2)).to.be.bignumber.equal(new BN(400).mul(INITIAL_STAKE_MULTIPLE).addn(400));
          });

          it('updates dao balances', async function () {
            expect(await this.dollar.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(2000));
            expect(await this.pool.totalClaimable()).to.be.bignumber.equal(new BN(1200));
            expect(await this.pool.totalRewarded()).to.be.bignumber.equal(new BN(800));
            expect(await this.pool.totalPhantom()).to.be.bignumber.equal(new BN(1200).mul(INITIAL_STAKE_MULTIPLE).addn(1000));
          });

          it('emits Unbond event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Unbond', {
              account: userAddress
            });

            expect(event.args.start).to.be.bignumber.equal(new BN(4));
            expect(event.args.value).to.be.bignumber.equal(new BN(800));
            expect(event.args.newClaimable).to.be.bignumber.equal(new BN(1200));
          });
        });

        describe('potential subtraction underflow', function () {
          beforeEach(async function () {
            await this.univ2.faucet(userAddress1, 1000);
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress1});
            await this.pool.deposit(1000, {from: userAddress1});

            await this.univ2.faucet(userAddress2, 1000);
            await this.univ2.approve(this.pool.address, 1000, {from: userAddress2});
            await this.pool.deposit(1000, {from: userAddress2});

            await this.pool.bond(600, {from: userAddress1});
            await this.pool.bond(500, {from: userAddress2});

            await incrementEpoch(this.dao);
            await this.dollar.mint(this.pool.address, 1000);

            await this.pool.unbond(new BN(1000), {from: userAddress});
            await this.pool.bond(new BN(1000), {from: userAddress});
            await this.pool.unbond(new BN(600), {from: userAddress});

            this.result = await this.pool.unbond(new BN(200), {from: userAddress});
            this.txHash = this.result.tx;
          });

          it('is frozen', async function () {
            expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
          });

          it('updates users balances', async function () {
            expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfClaimable(userAddress)).to.be.bignumber.equal(new BN(1476));
            expect(await this.pool.balanceOfRewarded(userAddress)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfPhantom(userAddress)).to.be.bignumber.equal(new BN(200).mul(INITIAL_STAKE_MULTIPLE).addn(296));
            expect(await this.pool.balanceOfClaimable(userAddress1)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfRewarded(userAddress1)).to.be.bignumber.equal(new BN(286));
            expect(await this.pool.balanceOfPhantom(userAddress1)).to.be.bignumber.equal(new BN(600).mul(INITIAL_STAKE_MULTIPLE).addn(600));
            expect(await this.pool.balanceOfClaimable(userAddress2)).to.be.bignumber.equal(new BN(0));
            expect(await this.pool.balanceOfRewarded(userAddress2)).to.be.bignumber.equal(new BN(238));
            expect(await this.pool.balanceOfPhantom(userAddress2)).to.be.bignumber.equal(new BN(500).mul(INITIAL_STAKE_MULTIPLE).addn(500));
          });

          it('updates dao balances', async function () {
            expect(await this.dollar.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(2000));
            expect(await this.pool.totalClaimable()).to.be.bignumber.equal(new BN(1476));
            expect(await this.pool.totalRewarded()).to.be.bignumber.equal(new BN(524));
            expect(await this.pool.totalPhantom()).to.be.bignumber.equal(new BN(1300).mul(INITIAL_STAKE_MULTIPLE).addn(1396));
          });

          it('emits Unbond event', async function () {
            const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Unbond', {
              account: userAddress
            });

            expect(event.args.start).to.be.bignumber.equal(new BN(4));
            expect(event.args.value).to.be.bignumber.equal(new BN(200));
            expect(event.args.newClaimable).to.be.bignumber.equal(new BN(0));
          });
        });
      });
    });

    describe('when provide', function () {
      beforeEach(async function () {
        await this.univ2.faucet(userAddress, 1000);
        await this.univ2.approve(this.pool.address, 1000, {from: userAddress});
        await this.pool.deposit(1000, {from: userAddress});
        await this.pool.bond(1000, {from: userAddress});

        incrementEpoch(this.dao);
        await this.dollar.mint(this.pool.address, 1000);
      });

      describe('not enough rewards', function () {
        it('reverts', async function () {
          await expectRevert(this.pool.provide(2000, {from: userAddress}), "Pool: insufficient rewarded balance");
        });
      });

      describe('simple', function () {
        const phantomAfterLessReward = new BN(1000).mul(INITIAL_STAKE_MULTIPLE).addn(1000);
        const phantomAfterNewBonded = phantomAfterLessReward.add(new BN(10).mul(INITIAL_STAKE_MULTIPLE).addn(10));

        beforeEach(async function () {
          await this.usdc.mint(userAddress, 1000);
          await this.usdc.approve(this.pool.address, 1000, {from: userAddress});

          await this.univ2.set(1000, 1000, 10);

          this.result = await this.pool.provide(1000, {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('is frozen', async function () {
          expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FROZEN);
        });

        it('updates users balances', async function () {
          expect(await this.univ2.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.balanceOfClaimable(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(1010));
          expect(await this.pool.balanceOfRewarded(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.balanceOfPhantom(userAddress)).to.be.bignumber.equal(phantomAfterNewBonded);
        });

        it('updates dao balances', async function () {
          expect(await this.univ2.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(1010));
          expect(await this.pool.totalStaged()).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.totalClaimable()).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.totalBonded()).to.be.bignumber.equal(new BN(1010));
          expect(await this.pool.totalRewarded()).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.totalPhantom()).to.be.bignumber.equal(phantomAfterNewBonded);
        });

        it('emits Deposit event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Provide', {
            account: userAddress
          });

          expect(event.args.value).to.be.bignumber.equal(new BN(1000));
          expect(event.args.lessUsdc).to.be.bignumber.equal(new BN(1000));
          expect(event.args.newUniv2).to.be.bignumber.equal(new BN(10));
        });
      });

      describe('complex', function () {
        const phantomAfterLessReward = new BN(1000).mul(INITIAL_STAKE_MULTIPLE).addn(1000);
        const phantomAfterNewBonded = phantomAfterLessReward.add(new BN(10).mul(INITIAL_STAKE_MULTIPLE).addn(15));
        const totalPhantom = phantomAfterNewBonded.add(new BN(1000).mul(INITIAL_STAKE_MULTIPLE).addn(1000));

        beforeEach(async function () {
          await this.usdc.mint(userAddress, 3000);
          await this.usdc.approve(this.pool.address, 3000, {from: userAddress});

          await this.univ2.faucet(userAddress1, 1000);
          await this.univ2.approve(this.pool.address, 1000, {from: userAddress1});
          await this.pool.deposit(1000, {from: userAddress1});
          await this.pool.bond(1000, {from: userAddress1});

          incrementEpoch(this.dao);
          await this.dollar.mint(this.pool.address, 1000);

          // 1000 ESD + 3000 USDC
          await this.univ2.set(1000, 3000, 10);

          this.result = await this.pool.provide(1000, {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('is frozen', async function () {
          expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FROZEN);
        });

        it('updates users balances', async function () {
          expect(await this.univ2.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.balanceOfClaimable(userAddress)).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(1010));
          expect(await this.pool.balanceOfRewarded(userAddress)).to.be.bignumber.equal(new BN(500));
          expect(await this.pool.balanceOfPhantom(userAddress)).to.be.bignumber.equal(phantomAfterNewBonded);
        });

        it('updates dao balances', async function () {
          expect(await this.univ2.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(2010));
          expect(await this.pool.totalStaged()).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.totalClaimable()).to.be.bignumber.equal(new BN(0));
          expect(await this.pool.totalBonded()).to.be.bignumber.equal(new BN(2010));
          expect(await this.pool.totalRewarded()).to.be.bignumber.equal(new BN(1000));
          expect(await this.pool.totalPhantom()).to.be.bignumber.equal(totalPhantom);
        });

        it('emits Deposit event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Provide', {
            account: userAddress
          });

          expect(event.args.value).to.be.bignumber.equal(new BN(1000));
          expect(event.args.lessUsdc).to.be.bignumber.equal(new BN(3000));
          expect(event.args.newUniv2).to.be.bignumber.equal(new BN(10));
        });
      });
    });
  });

  describe('fluid', function () {
    beforeEach(async function () {
      await this.dollar.mint(this.pool.address, 1000);
      await this.univ2.faucet(userAddress, 1000);
      await this.univ2.approve(this.pool.address, 1000, {from: userAddress});
      await this.pool.deposit(1000, {from: userAddress});

      await this.pool.bond(500, {from: userAddress});
    });

    it('is fluid', async function () {
      expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
    });

    describe('when deposit', function () {
      it('reverts', async function () {
        await expectRevert(this.pool.deposit(1000, {from: userAddress}), "Pool: Not frozen");
      });
    });

    describe('when withdraw', function () {
      it('reverts', async function () {
        await expectRevert(this.pool.withdraw(1000, {from: userAddress}), "Pool: Not frozen");
      });
    });

    describe('when claim', function () {
      it('reverts', async function () {
        await expectRevert(this.pool.claim(1000, {from: userAddress}), "Pool: Not frozen");
      });
    });

    describe('when provide', function () {
      it('reverts', async function () {
        await expectRevert(this.pool.provide(1000, {from: userAddress}), "Pool: Not frozen");
      });
    });

    describe('when bond', function () {
      beforeEach(async function () {
        this.result = await this.pool.bond(500, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('is fluid', async function () {
        expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
      });

      it('updates users balances', async function () {
        expect(await this.univ2.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.pool.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.pool.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(1000));
      });

      it('updates dao balances', async function () {
        expect(await this.univ2.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(1000));
        expect(await this.pool.totalBonded()).to.be.bignumber.equal(new BN(1000));
        expect(await this.pool.totalStaged()).to.be.bignumber.equal(new BN(0));
      });

      it('emits Bond event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Bond', {
          account: userAddress
        });

        expect(event.args.start).to.be.bignumber.equal(new BN(2));
        expect(event.args.value).to.be.bignumber.equal(new BN(500));
      });
    });

    describe('when unbond', function () {
      beforeEach(async function () {
        this.result = await this.pool.unbond(new BN(500), {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('is fluid', async function () {
        expect(await this.pool.statusOf(userAddress)).to.be.bignumber.equal(FLUID);
      });

      it('updates users balances', async function () {
        expect(await this.univ2.balanceOf(userAddress)).to.be.bignumber.equal(new BN(0));
        expect(await this.pool.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(1000));
        expect(await this.pool.balanceOfBonded(userAddress)).to.be.bignumber.equal(new BN(0));
      });

      it('updates dao balances', async function () {
        expect(await this.univ2.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(1000));
        expect(await this.pool.totalBonded()).to.be.bignumber.equal(new BN(0));
        expect(await this.pool.totalStaged()).to.be.bignumber.equal(new BN(1000));
      });

      it('emits Unbond event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockPool, 'Unbond', {
          account: userAddress
        });

        expect(event.args.start).to.be.bignumber.equal(new BN(2));
        expect(event.args.value).to.be.bignumber.equal(new BN(500));
        expect(event.args.newClaimable).to.be.bignumber.equal(new BN(1000));
      });
    });
  });

  describe('when pause', function () {
    beforeEach(async function () {
      await this.univ2.faucet(userAddress, 1000);
      await this.univ2.approve(this.pool.address, 1000, {from: userAddress});
      await this.pool.deposit(1000, {from: userAddress});
      await this.pool.bond(1000, {from: userAddress});
      await this.dao.set((await this.dao.epoch()) + 1);
      await this.dollar.mint(this.pool.address, 1000);
      await this.pool.unbond(500, {from: userAddress});
      await this.dao.set((await this.dao.epoch()) + 1);
    });

    describe('as dao', function () {
      beforeEach(async function () {
        await this.pool.set(mockDao, this.dollar.address, this.univ2.address);
        await this.pool.emergencyPause({from: mockDao});
        await this.pool.set(this.dao.address, this.dollar.address, this.univ2.address);
      });

      it('is paused', async function () {
        expect(await this.pool.paused()).to.be.equal(true);
      });

      it('reverts on deposit', async function () {
        await expectRevert(this.pool.deposit(2000, {from: userAddress}), "Paused");
      });

      it('reverts on bond', async function () {
        await expectRevert(this.pool.bond(2000, {from: userAddress}), "Paused");
      });

      it('reverts on provide', async function () {
        await expectRevert(this.pool.provide(2000, {from: userAddress}), "Paused");
      });

      describe('withdraw', function () {
        beforeEach(async function () {
          await this.pool.withdraw(200, {from: userAddress})
        });

        it('basic withdraw check', async function () {
          expect(await this.univ2.balanceOf(userAddress)).to.be.bignumber.equal(new BN(200));
        });
      });

      describe('unbond', function () {
        beforeEach(async function () {
          await this.pool.unbond(200, {from: userAddress})
        });

        it('basic unbond check', async function () {
          expect(await this.pool.balanceOfStaged(userAddress)).to.be.bignumber.equal(new BN(700));
          expect(await this.pool.balanceOfClaimable(userAddress)).to.be.bignumber.equal(new BN(700));
        });
      });

      describe('claim', function () {
        beforeEach(async function () {
          await this.pool.claim(200, {from: userAddress})
        });

        it('basic claim check', async function () {
          expect(await this.dollar.balanceOf(userAddress)).to.be.bignumber.equal(new BN(200));
        });
      });
    });

    describe('as not dao', function () {
      it('reverts', async function () {
        await expectRevert(this.pool.emergencyPause({from: userAddress}), "Not dao");
      });
    });
  });

  describe('when emergency withdraw', function () {
    beforeEach(async function () {
      await this.univ2.faucet(userAddress, 1000);
      await this.univ2.approve(this.pool.address, 1000, {from: userAddress});
      await this.pool.deposit(1000, {from: userAddress});
      await this.pool.bond(1000, {from: userAddress});
      await this.dao.set((await this.dao.epoch()) + 1);
      await this.dollar.mint(this.pool.address, 1000);
    });

    describe('as dao', function () {
      beforeEach(async function () {
        await this.pool.set(mockDao, this.dollar.address, this.univ2.address);
        await this.pool.emergencyWithdraw(this.univ2.address, 1000, {from: mockDao});
        await this.pool.emergencyWithdraw(this.dollar.address, 1000, {from: mockDao});
      });

      it('transfers funds to the dao', async function () {
        expect(await this.univ2.balanceOf(mockDao)).to.be.bignumber.equal(new BN(1000));
        expect(await this.univ2.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(0));
        expect(await this.dollar.balanceOf(mockDao)).to.be.bignumber.equal(new BN(1000));
        expect(await this.dollar.balanceOf(this.pool.address)).to.be.bignumber.equal(new BN(0));
      });
    });

    describe('as not dao', function () {
      it('reverts', async function () {
        await expectRevert(this.pool.emergencyWithdraw(this.univ2.address, 1000, {from: userAddress}), "Not dao");
      });
    });
  });
});