const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockAuction = contract.fromArtifact('MockAuction');
const MockMarket = contract.fromArtifact('MockMarket');
const Dollar = contract.fromArtifact('Dollar');
const DAO = contract.fromArtifact('IDAO');

describe('Auction', function () {
  const [ ownerAddress, poolAddress, userAddress, userAddress2, userAddress3,  userAddress4 ] = accounts;

  beforeEach(async function () {
    this.auction = await MockAuction.new({from: ownerAddress});
    this.market = await MockMarket.new(poolAddress, {from: ownerAddress, gas: 8000000});
    this.dollar = await Dollar.at(await this.market.dollar());

    await this.auction.incrementEpochE();
    await this.market.stepE();
    await this.market.mintToE(userAddress, 1000000);
    await this.dollar.approve(this.market.address, 1000000, {from: userAddress});
  });

  describe('when settling auction', function () {
    describe('auction is not finished and not canceled', function () {
      beforeEach(async function () {
        await this.auction.incrementTotalDebtE(100000);
        await this.auction.initCouponAuctionE(this.auction.address);

      });

      //it('is able to settle auction and generated internals and deincrement debt', async function () {
      it('getCouponAuctionMinExpiryE', async function () {
        // add some bidders
        this.result = await this.auction.placeCouponAuctionBid(20, 1000, 50000, {from: userAddress});
        this.result1 = await this.auction.placeCouponAuctionBid(5, 2000, 50000, {from: userAddress2});
        //thise bidders will be rejected
        this.result2 = await this.auction.placeCouponAuctionBid(1000, 100, 50000, {from: userAddress3});
        this.result3 = await this.auction.placeCouponAuctionBid(100990, 100, 50000, {from: userAddress4});
        await this.auction.settleCouponAuctionE();
        //expect(await this.auction.getCouponAuctionBidsE.call()).to.be.bignumber.equal(new BN(1));
        expect(await this.auction.getCouponAuctionMinExpiryE.call()).to.be.bignumber.equal(new BN(1));
        /*expect(await this.auction.getCouponAuctionMaxExpiryE.call()).to.be.bignumber.equal(new BN(1));
        expect(await this.auction.getCouponAuctionMinYieldE.call()).to.be.bignumber.equal(new BN(1));
        expect(await this.auction.getCouponAuctionMaxYieldE.call()).to.be.bignumber.equal(new BN(1));
        expect(await this.auction.getCouponAuctionMinDollarAmountE.call()).to.be.bignumber.equal(new BN(1));
        expect(await this.auction.getCouponAuctionMaxDollarAmountE.call()).to.be.bignumber.equal(new BN(1));
        */

        expect(await this.auction.getMinExpiryFilled(1)).to.be.bignumber.equal(new BN(1));
        expect(await this.auction.getMaxExpiryFilled(1)).to.be.bignumber.equal(new BN(1));
        expect(await this.auction.getAvgExpiryFilled(1)).to.be.bignumber.equal(new BN(1));
        expect(await this.auction.getMinYieldFilled(1)).to.be.bignumber.equal(new BN(1));
        expect(await this.auction.getMaxYieldFilled(1)).to.be.bignumber.equal(new BN(1));
        expect(await this.auction.getAvgYieldFilled(1)).to.be.bignumber.equal(new BN(1));
        expect(await this.auction.getBidToCover(1)).to.be.bignumber.equal(new BN(1));
        expect(await this.auction.getTotalFilled(1)).to.be.bignumber.equal(new BN(1));
      });

      it('getCouponAuctionMaxExpiryE', async function () {
        // add some bidders
        this.result = await this.auction.placeCouponAuctionBid(20, 1000, 50000, {from: userAddress});
        this.result1 = await this.auction.placeCouponAuctionBid(5, 2000, 50000, {from: userAddress2});
        //thise bidders will be rejected
        this.result2 = await this.auction.placeCouponAuctionBid(1000, 100, 50000, {from: userAddress3});
        this.result3 = await this.auction.placeCouponAuctionBid(100990, 100, 50000, {from: userAddress4});
        //await this.auction.settleCouponAuctionE();
        //expect(await this.auction.getCouponAuctionBidsE.call()).to.be.bignumber.equal(new BN(1));
        //expect(await this.auction.getCouponAuctionMinExpiryE.call()).to.be.bignumber.equal(new BN(1));
        expect(await this.auction.getCouponAuctionMaxExpiryE.call()).to.be.bignumber.equal(new BN(1));
        //expect(await this.auction.getCouponAuctionMinYieldE.call()).to.be.bignumber.equal(new BN(1));
        //expect(await this.auction.getCouponAuctionMaxYieldE.call()).to.be.bignumber.equal(new BN(1));
        //expect(await this.auction.getCouponAuctionMinDollarAmountE.call()).to.be.bignumber.equal(new BN(1));

      });
      

      it('getCouponAuctionMinYieldE', async function () {
        // add some bidders
        this.result = await this.auction.placeCouponAuctionBid(20, 1000, 50000, {from: userAddress});
        this.result1 = await this.auction.placeCouponAuctionBid(5, 2000, 50000, {from: userAddress2});
        //thise bidders will be rejected
        this.result2 = await this.auction.placeCouponAuctionBid(1000, 100, 50000, {from: userAddress3});
        this.result3 = await this.auction.placeCouponAuctionBid(100990, 100, 50000, {from: userAddress4});
        //await this.auction.settleCouponAuctionE();
        //expect(await this.auction.getCouponAuctionBidsE.call()).to.be.bignumber.equal(new BN(1));
        //expect(await this.auction.getCouponAuctionMinExpiryE.call()).to.be.bignumber.equal(new BN(1));
        //expect(await this.auction.getCouponAuctionMaxExpiryE.call()).to.be.bignumber.equal(new BN(1));
        expect(await this.auction.getCouponAuctionMinYieldE.call()).to.be.bignumber.equal(new BN(1));
        //expect(await this.auction.getCouponAuctionMaxYieldE.call()).to.be.bignumber.equal(new BN(1));
        //expect(await this.auction.getCouponAuctionMinDollarAmountE.call()).to.be.bignumber.equal(new BN(1));
        //expect(await this.auction.getCouponAuctionMaxDollarAmountE.call()).to.be.bignumber.equal(new BN(1));
      });
      

      it('getCouponAuctionMaxYieldE', async function () {
        // add some bidders
        this.result = await this.auction.placeCouponAuctionBid(20, 1000, 50000, {from: userAddress});
        this.result1 = await this.auction.placeCouponAuctionBid(5, 2000, 50000, {from: userAddress2});
        //thise bidders will be rejected
        this.result2 = await this.auction.placeCouponAuctionBid(1000, 100, 50000, {from: userAddress3});
        this.result3 = await this.auction.placeCouponAuctionBid(100990, 100, 50000, {from: userAddress4});
        //await this.auction.settleCouponAuctionE();
        expect(await this.auction.getCouponAuctionMaxYieldE.call()).to.be.bignumber.equal(new BN(1));
      });

      it('getCouponAuctionMinDollarAmountE', async function () {
        // add some bidders
        this.result = await this.auction.placeCouponAuctionBid(20, 1000, 50000, {from: userAddress});
        this.result1 = await this.auction.placeCouponAuctionBid(5, 2000, 50000, {from: userAddress2});
        //thise bidders will be rejected
        this.result2 = await this.auction.placeCouponAuctionBid(1000, 100, 50000, {from: userAddress3});
        this.result3 = await this.auction.placeCouponAuctionBid(100990, 100, 50000, {from: userAddress4});
        //await this.auction.settleCouponAuctionE();
        expect(await this.auction.getCouponAuctionMinDollarAmountE.call()).to.be.bignumber.equal(new BN(1));
      });


      it('getCouponAuctionMaxDollarAmountE', async function () {
        // add some bidders
        this.result = await this.auction.placeCouponAuctionBid(20, 1000, 50000, {from: userAddress});
        this.result1 = await this.auction.placeCouponAuctionBid(5, 2000, 50000, {from: userAddress2});
        //thise bidders will be rejected
        this.result2 = await this.auction.placeCouponAuctionBid(1000, 100, 50000, {from: userAddress3});
        this.result3 = await this.auction.placeCouponAuctionBid(100990, 100, 50000, {from: userAddress4});
        //await this.auction.settleCouponAuctionE();
        expect(await this.auction.getCouponAuctionMaxDollarAmountE.call()).to.be.bignumber.equal(new BN(1));
      });
    });
    describe('auction is finished', function () {

    });
    describe('auction is canceled', function () {

    });
  });
});