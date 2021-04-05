const { accounts, contract } = require("@openzeppelin/test-environment");

const { expect } = require("chai");

const MockRegulator = contract.fromArtifact("MockRegulator");
const MockSettableOracle = contract.fromArtifact("MockSettableOracle");
const Dollar = contract.fromArtifact("Dollar");

describe("Regulator", function () {
  beforeEach(async function () {
    this.oracle = await MockSettableOracle.new({
      from: ownerAddress,
      gas: 8000000,
    });
    this.regulator = await MockRegulator.new(this.oracle.address, poolAddress, {
      from: ownerAddress,
      gas: 8000000,
    });
    this.dollar = await Dollar.at(await this.regulator.dollar());
  });

  const [ownerAddress, _, poolAddress] = accounts;

  describe("step", function () {
    expect(true, "NoOp");
  });
});
