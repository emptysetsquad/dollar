const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockAuction = contract.fromArtifact('MockAuction');

describe('Auction', function () {
  const [ ownerAddress ] = accounts;

  beforeEach(async function () {
    this.auction = await MockAuction.new({from: ownerAddress});
  });

  describe('when settling auction', function () {
    describe('auction is not finished and not canceled', function () {

    });
    describe('auction is finished', function () {

    });
    describe('auction is canceled', function () {

    });
  });
});