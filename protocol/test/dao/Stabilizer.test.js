const { accounts, contract } = require("@openzeppelin/test-environment");

const { expect } = require("chai");

const MockStabilizer = contract.fromArtifact("MockStabilizer");
const Dollar = contract.fromArtifact("Dollar");

describe("Stabilizer", function () {
  const [ownerAddress, poolAddress] = accounts;

  beforeEach(async function () {
    this.stabilizer = await MockStabilizer.new(poolAddress, {
      from: ownerAddress,
      gas: 8000000,
    });
    this.dollar = await Dollar.at(await this.stabilizer.dollar());
  });

  describe("step", function () {
    expect(true, "NoOp");
  });
});
