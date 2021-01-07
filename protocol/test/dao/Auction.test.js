const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockAuction = contract.fromArtifact('MockAuction');
const MockMarket = contract.fromArtifact('MockMarket');
const Dollar = contract.fromArtifact('Dollar');

describe('Auction', function () {
  const [ ownerAddress, poolAddress, userAddress, userAddress2, userAddress3,  userAddress4 ] = accounts;

  beforeEach(async function () {
    this.auction = await MockAuction.new(poolAddress, {from: ownerAddress, gas: 8000000});
    this.dollar = await Dollar.at(await this.auction.dollar());

    await this.auction.incrementEpochE();
    await this.auction.stepE();
    await this.auction.mintToE(userAddress, 1000000);
    await this.auction.mintToE(userAddress2, 1000000);
    await this.auction.mintToE(userAddress3, 1000000);
    await this.auction.mintToE(userAddress4, 1000000);
    await this.dollar.approve(this.auction.address, 1000000, {from: userAddress});
    await this.dollar.approve(this.auction.address, 1000000, {from: userAddress2});
    await this.dollar.approve(this.auction.address, 1000000, {from: userAddress3});
    await this.dollar.approve(this.auction.address, 1000000, {from: userAddress4});
  });

  describe('when settling auction', function () {
    describe('auction is not finished and not canceled', function () {
      beforeEach(async function () {
        await this.auction.incrementTotalDebtE(4000);
        await this.auction.initCouponAuctionE(this.auction.address);
      });


      it('is able to settle auction and generated internals and deincrement debt', async function () {
        // add some bidders
        this.result = await this.auction.placeCouponAuctionBid(20, 1000, 50000, {from: userAddress});
        this.result1 = await this.auction.placeCouponAuctionBid(5, 2000, 50000, {from: userAddress2});
        //thise bidders will be rejected
        this.result2 = await this.auction.placeCouponAuctionBid(1000, 900, 50000, {from: userAddress3});
        this.result3 = await this.auction.placeCouponAuctionBid(100990, 900, 50000, {from: userAddress4});
        this.auction_settlement = this.auction.settleCouponAuctionE();
        

        expect(await this.auction.getCouponAuctionBidsE.call()).to.be.bignumber.equal(new BN(4));
        expect(await this.auction.getCouponAuctionMinExpiryE.call()).to.be.bignumber.equal(new BN(6));
        expect(await this.auction.getCouponAuctionMaxExpiryE.call()).to.be.bignumber.equal(new BN(100991));
        expect(await this.auction.getCouponAuctionMinYieldE.call()).to.be.bignumber.equal(new BN(25));
        expect(await this.auction.getCouponAuctionMaxYieldE.call()).to.be.bignumber.equal(new BN(55));
        expect(await this.auction.getCouponAuctionMinDollarAmountE.call()).to.be.bignumber.equal(new BN(900));
        expect(await this.auction.getCouponAuctionMaxDollarAmountE.call()).to.be.bignumber.equal(new BN(2000));

        expect(await this.auction.getMinExpiryFilled(1)).to.be.bignumber.equal(new BN(6));
        expect(await this.auction.getMaxExpiryFilled(1)).to.be.bignumber.equal(new BN(1001));
        //TODO getAvgYieldFilled
        expect(await this.auction.getAvgExpiryFilled(1)).to.be.bignumber.equal(new BN(0));
        expect(await this.auction.getMinYieldFilled(1)).to.be.bignumber.equal(new BN(10));
        expect(await this.auction.getMaxYieldFilled(1)).to.be.bignumber.equal(new BN(55));
        //TODO getAvgYieldFilled
        expect(await this.auction.getAvgYieldFilled(1)).to.be.bignumber.equal(new BN(0));
        //TODO getBidToCover
        expect(await this.auction.getBidToCover(1)).to.be.bignumber.equal(new BN(1));
        expect(await this.auction.getTotalFilled(1)).to.be.bignumber.equal(new BN(3));
      });
    });

    describe('auction is finished', function () {
      beforeEach(async function () {
        //finish the auction
        await this.auction.incrementTotalDebtE(4000);
        await this.auction.initCouponAuctionE(this.auction.address);
        await this.auction.finishCouponAuctionAtEpochE(1);
      });

      it('is able to not settle auction', async function () {
        // add some bidders
        this.result = await this.auction.placeCouponAuctionBid(20, 1000, 50000, {from: userAddress});
        this.result1 = await this.auction.placeCouponAuctionBid(5, 2000, 50000, {from: userAddress2});
        this.auction_settlement = await this.auction.settleCouponAuctionE.call();
        expect(this.auction_settlement).to.be.equal(false);
      });


    });
    describe('auction is canceled', function () {
      beforeEach(async function () {
        //finish the auction
        await this.auction.incrementTotalDebtE(4000);
        await this.auction.initCouponAuctionE(this.auction.address);
        await this.auction.cancelCouponAuctionAtEpochE(1);
      });

      it('is able to not settle auction', async function () {
        // add some bidders
        this.result = await this.auction.placeCouponAuctionBid(20, 1000, 50000, {from: userAddress});
        this.result1 = await this.auction.placeCouponAuctionBid(5, 2000, 50000, {from: userAddress2});
        this.auction_settlement = await this.auction.settleCouponAuctionE.call();
        expect(this.auction_settlement).to.be.equal(false);
      });

    });
  });
});