const { accounts, contract } = require('@openzeppelin/test-environment');

const { BN, expectRevert, time } = require('@openzeppelin/test-helpers');
const { expect } = require('chai');

const MockAuction = contract.fromArtifact('MockAuction');

describe('Auction', function () {
  const [ ownerAddress ] = accounts;

});