const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectEvent, expectRevert } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const Dollar = contract.fromArtifact('Dollar');
const MockGovern = contract.fromArtifact('MockGovern');
const MockImplA = contract.fromArtifact('MockImplA');
const MockImplB = contract.fromArtifact('MockImplB');

const VOTE_PERIOD = 9;
const EMERGENCY_COMMIT_PERIOD = 6;

const UNDECIDED = new BN(0);
const APPROVE = new BN(1);
const REJECT = new BN(2);

const INITIAL_STAKE_MULTIPLE = new BN(10).pow(new BN(6)); // 100 ESD -> 100M ESDS

describe('Govern', function () {
  const [ ownerAddress, userAddress, userAddress2, userAddress3 ] = accounts;

  beforeEach(async function () {
    this.govern = await MockGovern.new({from: ownerAddress, gas: 8000000});
    this.dollar = await Dollar.at(await this.govern.dollar());

    this.implA = await MockImplA.new({from: ownerAddress});
    this.implB = await MockImplB.new({from: ownerAddress});

    await this.govern.upgradeToE(this.implA.address);
    await this.govern.incrementEpochE();
  });

  describe('vote', function () {
    describe('cant vote', function () {
      describe('when no stake', function () {
        it('reverts', async function () {
          await expectRevert(this.govern.vote(this.implB.address, APPROVE, {from: userAddress}), "Govern: Must have stake");
        });
      });

      describe('when not enough stake to propose', function () {
        beforeEach(async function () {
          await this.govern.incrementBalanceOfE(userAddress, INITIAL_STAKE_MULTIPLE.muln(1));
          await this.govern.incrementBalanceOfE(userAddress2, INITIAL_STAKE_MULTIPLE.muln(999));
          await this.govern.incrementTotalBondedE(1000);
        });

        it('reverts', async function () {
          await expectRevert(this.govern.vote(this.implB.address, APPROVE, {from: userAddress}), "Govern: Not enough stake");
        });
      });

      describe('when ended', function () {
        beforeEach(async function () {
          await this.govern.incrementBalanceOfE(userAddress, INITIAL_STAKE_MULTIPLE.muln(1000));
          await this.govern.incrementBalanceOfE(userAddress2, INITIAL_STAKE_MULTIPLE.muln(1000));
          await this.govern.incrementTotalBondedE(2000);

          await this.govern.vote(this.implB.address, APPROVE, {from: userAddress2});
          for (let i = 0; i < VOTE_PERIOD; i++) {
            await this.govern.incrementEpochE();
          }
        });

        it('is frozen', async function () {
          expect(await this.govern.statusOf(userAddress)).to.be.bignumber.equal(new BN(0));
        });

        it('reverts', async function () {
          await expectRevert(this.govern.vote(this.implB.address, APPROVE, {from: userAddress}), "Govern: Ended");
        });
      });

      describe('when fluid', function () {
        beforeEach(async function () {
          await this.govern.unfreezeE(userAddress);
        });

        it('is fluid', async function () {
          expect(await this.govern.statusOf(userAddress)).to.be.bignumber.equal(new BN(1));
        });

        it('reverts', async function () {
          await expectRevert(this.govern.vote(this.implB.address, APPROVE, {from: userAddress}), "Permission: Not frozen or locked");
        });
      });
    });

    describe('can vote', function () {
      beforeEach(async function () {
        await this.govern.incrementBalanceOfE(userAddress, INITIAL_STAKE_MULTIPLE.muln(1000));
        await this.govern.incrementBalanceOfE(userAddress2, INITIAL_STAKE_MULTIPLE.muln(1000));
        await this.govern.incrementBalanceOfE(userAddress3, INITIAL_STAKE_MULTIPLE.muln(1000));
        await this.govern.incrementTotalBondedE(3000);
      });

      describe('when vote', function () {
        beforeEach(async function () {
          this.result = await this.govern.vote(this.implB.address, APPROVE, {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('sets vote counter correctly', async function () {
          expect(await this.govern.approveFor(this.implB.address)).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
          expect(await this.govern.rejectFor(this.implB.address)).to.be.bignumber.equal(new BN(0));
        });

        it('is nominated', async function () {
          expect(await this.govern.isNominated(this.implB.address)).to.be.equal(true);
        });

        it('records vote', async function () {
          expect(await this.govern.recordedVote(userAddress, this.implB.address)).to.be.bignumber.equal(APPROVE);
        });

        it('user is locked', async function () {
          expect(await this.govern.statusOf(userAddress)).to.be.bignumber.equal(new BN(2));
        });

        it('emits Vote event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockGovern, 'Vote', {
            account: userAddress,
            candidate: this.implB.address,
          });

          expect(event.args.vote).to.be.bignumber.equal(APPROVE);
          expect(event.args.bonded).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
        });

        it('emits Proposal event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockGovern, 'Proposal', {
            candidate: this.implB.address,
            account: userAddress,
          });

          expect(event.args.start).to.be.bignumber.equal(new BN(1));
          expect(event.args.period).to.be.bignumber.equal(new BN(VOTE_PERIOD));
        });
      });

      describe('when vote and wait', function () {
        beforeEach(async function () {
          await this.govern.vote(this.implB.address, APPROVE, {from: userAddress});
        });

        describe('6 epochs', function () {
          beforeEach(async function () {
            for (let i = 0; i < 6; i++) {
              await this.govern.incrementEpochE();
            }
          });

          it('user is locked', async function () {
            expect(await this.govern.statusOf(userAddress)).to.be.bignumber.equal(new BN(2));
          });
        });

        describe('vote period epochs', function () {
          beforeEach(async function () {
            for (let i = 0; i < VOTE_PERIOD; i++) {
              await this.govern.incrementEpochE();
            }
          });

          it('user is bonded', async function () {
            expect(await this.govern.statusOf(userAddress)).to.be.bignumber.equal(new BN(0));
          });
        });
      });

      describe('when multiple vote', function () {
        beforeEach(async function () {
          await this.govern.vote(this.implB.address, REJECT, {from: userAddress2});
          await this.govern.vote(this.implB.address, APPROVE, {from: userAddress3});
          this.result = await this.govern.vote(this.implB.address, APPROVE, {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('sets vote counter correctly', async function () {
          expect(await this.govern.approveFor(this.implB.address)).to.be.bignumber.equal(new BN(2000).mul(INITIAL_STAKE_MULTIPLE));
          expect(await this.govern.rejectFor(this.implB.address)).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
        });

        it('is nominated', async function () {
          expect(await this.govern.isNominated(this.implB.address)).to.be.equal(true);
        });

        it('records vote', async function () {
          expect(await this.govern.recordedVote(userAddress, this.implB.address)).to.be.bignumber.equal(APPROVE);
          expect(await this.govern.recordedVote(userAddress2, this.implB.address)).to.be.bignumber.equal(REJECT);
          expect(await this.govern.recordedVote(userAddress3, this.implB.address)).to.be.bignumber.equal(APPROVE);
        });

        it('user is locked', async function () {
          expect(await this.govern.statusOf(userAddress)).to.be.bignumber.equal(new BN(2));
          expect(await this.govern.statusOf(userAddress2)).to.be.bignumber.equal(new BN(2));
          expect(await this.govern.statusOf(userAddress3)).to.be.bignumber.equal(new BN(2));
        });

        it('emits Vote event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockGovern, 'Vote', {
            account: userAddress,
            candidate: this.implB.address,
          });

          expect(event.args.vote).to.be.bignumber.equal(APPROVE);
          expect(event.args.bonded).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
        });
      });

      describe('when revote', function () {
        beforeEach(async function () {
          await this.govern.vote(this.implB.address, APPROVE, {from: userAddress});
          await this.govern.vote(this.implB.address, REJECT, {from: userAddress2});
          await this.govern.vote(this.implB.address, APPROVE, {from: userAddress3});

          await this.govern.vote(this.implB.address, UNDECIDED, {from: userAddress3});
          this.result = await this.govern.vote(this.implB.address, REJECT, {from: userAddress});
          this.txHash = this.result.tx;
        });

        it('sets vote counter correctly', async function () {
          expect(await this.govern.approveFor(this.implB.address)).to.be.bignumber.equal(new BN(0));
          expect(await this.govern.rejectFor(this.implB.address)).to.be.bignumber.equal(new BN(2000).mul(INITIAL_STAKE_MULTIPLE));
        });

        it('is nominated', async function () {
          expect(await this.govern.isNominated(this.implB.address)).to.be.equal(true);
        });

        it('records vote', async function () {
          expect(await this.govern.recordedVote(userAddress, this.implB.address)).to.be.bignumber.equal(REJECT);
          expect(await this.govern.recordedVote(userAddress2, this.implB.address)).to.be.bignumber.equal(REJECT);
          expect(await this.govern.recordedVote(userAddress3, this.implB.address)).to.be.bignumber.equal(UNDECIDED);
        });

        it('user is locked', async function () {
          expect(await this.govern.statusOf(userAddress)).to.be.bignumber.equal(new BN(2));
          expect(await this.govern.statusOf(userAddress2)).to.be.bignumber.equal(new BN(2));
          expect(await this.govern.statusOf(userAddress3)).to.be.bignumber.equal(new BN(2));
        });

        it('emits Vote event', async function () {
          const event = await expectEvent.inTransaction(this.txHash, MockGovern, 'Vote', {
            account: userAddress,
            candidate: this.implB.address,
          });

          expect(event.args.vote).to.be.bignumber.equal(REJECT);
          expect(event.args.bonded).to.be.bignumber.equal(new BN(1000).mul(INITIAL_STAKE_MULTIPLE));
        });
      });
    });
  });

  describe('commit', function () {
    beforeEach(async function () {
      await this.govern.incrementBalanceOfE(userAddress, INITIAL_STAKE_MULTIPLE.muln(2500));
      await this.govern.incrementBalanceOfE(userAddress2, INITIAL_STAKE_MULTIPLE.muln(4000));
      await this.govern.incrementBalanceOfE(userAddress3, INITIAL_STAKE_MULTIPLE.muln(3500));
      await this.govern.incrementTotalBondedE(10000);
    });

    describe('before nomination', function () {
      it('is bonded', async function () {
        expect(await this.govern.isNominated(this.implB.address)).to.be.equal(false);
      });

      it('reverts', async function () {
        await expectRevert(this.govern.commit(this.implB.address, {from: userAddress}), "Govern: Not nominated");
      });
    });

    describe('before ended', function () {
      beforeEach(async function () {
          await this.govern.vote(this.implB.address, APPROVE, {from: userAddress});
      });

      it('reverts', async function () {
        await expectRevert(this.govern.commit(this.implB.address, {from: userAddress}), "Govern: Not ended");
      });
    });

    describe('ended with not enough votes', function () {
      beforeEach(async function () {
        await this.govern.vote(this.implB.address, APPROVE, {from: userAddress});
        for(let i = 0; i < VOTE_PERIOD; i++) {
          await this.govern.snapshotTotalBondedE();
          await this.govern.incrementEpochE();
        }
      });

      it('reverts', async function () {
        await expectRevert(this.govern.commit(this.implB.address, {from: userAddress}), "Govern: Must have quorom");
      });
    });

    describe('ended with not enough approve votes', function () {
      beforeEach(async function () {
        await this.govern.vote(this.implB.address, APPROVE, {from: userAddress});
        await this.govern.vote(this.implB.address, REJECT, {from: userAddress2});
        for(let i = 0; i < VOTE_PERIOD; i++) {
          await this.govern.snapshotTotalBondedE();
          await this.govern.incrementEpochE();
        }
      });

      it('reverts', async function () {
        await expectRevert(this.govern.commit(this.implB.address, {from: userAddress}), "Govern: Not approved");
      });
    });

    describe('ends successfully', function () {
      beforeEach(async function () {
        await this.govern.vote(this.implB.address, REJECT, {from: userAddress});
        await this.govern.vote(this.implB.address, APPROVE, {from: userAddress2});
        for(let i = 0; i < VOTE_PERIOD; i++) {
          await this.govern.snapshotTotalBondedE();
          await this.govern.incrementEpochE();
        }

        this.result = await this.govern.commit(this.implB.address, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('is updated', async function () {
        expect(await this.govern.implementation()).to.be.equal(this.implB.address);
        expect(await this.govern.isInitialized(this.implB.address)).to.be.equal(true);
      });

      it('emits Commit event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockGovern, 'Commit', {
          account: userAddress,
          candidate: this.implB.address,
        });
      });
    });

    describe('double commit - probably not possible in practice', function () {
      beforeEach(async function () {
        await this.govern.vote(this.implB.address, REJECT, {from: userAddress});
        await this.govern.vote(this.implB.address, APPROVE, {from: userAddress2});

        for(let i = 0; i < VOTE_PERIOD; i++) {
          await this.govern.snapshotTotalBondedE();
          await this.govern.incrementEpochE();
        }

        await this.govern.commit(this.implB.address, {from: userAddress});
      });

      it('reverts', async function () {
        await expectRevert(this.govern.commit(this.implB.address, {from: userAddress}), "Permission: Already initialized");
      });
    });
  });

  describe('emergency commit', function () {
    beforeEach(async function () {
      await this.govern.incrementBalanceOfE(userAddress, INITIAL_STAKE_MULTIPLE.muln(2500));
      await this.govern.incrementBalanceOfE(userAddress2, INITIAL_STAKE_MULTIPLE.muln(4000));
      await this.govern.incrementBalanceOfE(userAddress3, INITIAL_STAKE_MULTIPLE.muln(3500));
      await this.govern.incrementTotalBondedE(10000);

      const epoch = await this.govern.epoch();
      await this.govern.setEpochTime(epoch);
    });

    describe('before nomination', function () {
      it('is bonded', async function () {
        expect(await this.govern.isNominated(this.implB.address)).to.be.equal(false);
      });

      it('reverts', async function () {
        await expectRevert(this.govern.emergencyCommit(this.implB.address, {from: userAddress}), "Govern: Not nominated");
      });
    });

    describe('while synced', function () {
      beforeEach(async function () {
        await this.govern.vote(this.implB.address, APPROVE, {from: userAddress});
      });

      it('reverts', async function () {
        await expectRevert(this.govern.emergencyCommit(this.implB.address, {from: userAddress}), "Govern: Epoch synced");
      });
    });

    describe('ended with not enough approve votes', function () {
      beforeEach(async function () {
        await this.govern.vote(this.implB.address, APPROVE, {from: userAddress});
        await this.govern.vote(this.implB.address, APPROVE, {from: userAddress3});
        await this.govern.vote(this.implB.address, REJECT, {from: userAddress2});

        const epoch = await this.govern.epoch();
        await this.govern.setEpochTime(epoch + EMERGENCY_COMMIT_PERIOD);
      });

      it('reverts', async function () {
        await expectRevert(this.govern.emergencyCommit(this.implB.address, {from: userAddress}), "Govern: Must have super majority");
      });
    });

    describe('ends successfully', function () {
      beforeEach(async function () {
        await this.govern.vote(this.implB.address, REJECT, {from: userAddress});
        await this.govern.vote(this.implB.address, APPROVE, {from: userAddress2});
        await this.govern.vote(this.implB.address, APPROVE, {from: userAddress3});

        const epoch = await this.govern.epoch();
        await this.govern.setEpochTime(epoch + EMERGENCY_COMMIT_PERIOD);

        this.result = await this.govern.emergencyCommit(this.implB.address, {from: userAddress});
        this.txHash = this.result.tx;
      });

      it('is updated', async function () {
        expect(await this.govern.implementation()).to.be.equal(this.implB.address);
        expect(await this.govern.isInitialized(this.implB.address)).to.be.equal(true);
      });

      it('emits Commit event', async function () {
        const event = await expectEvent.inTransaction(this.txHash, MockGovern, 'Commit', {
          account: userAddress,
          candidate: this.implB.address,
        });
      });
    });
  });
});