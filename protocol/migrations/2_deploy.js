const Deployer1 = artifacts.require("Deployer1");
const Deployer2 = artifacts.require("Deployer2");
const Deployer3 = artifacts.require("Deployer3");
const Implementation = artifacts.require("Implementation");
const Root = artifacts.require("Root");
const TestnetUSDC = artifacts.require("TestnetUSDC");

async function deployTestnetUSDC(deployer) {
  await deployer.deploy(TestnetUSDC);
}

async function deployTestnet(deployer) {
  const d1 = await deployer.deploy(Deployer1);
  const root = await deployer.deploy(Root, d1.address);
  const rootAsD1 = await Deployer1.at(root.address);

  const d2 = await deployer.deploy(Deployer2);
  await rootAsD1.implement(d2.address);
  const rootAsD2 = await Deployer2.at(root.address);

  const d3 = await deployer.deploy(Deployer3);
  await rootAsD2.implement(d3.address);
  const rootAsD3 = await Deployer3.at(root.address);

  const implementation = await deployer.deploy(Implementation);
  await rootAsD3.implement(implementation.address);
}

module.exports = function(deployer) {
  deployer.then(async() => {
    console.log(deployer.network);
    switch (deployer.network) {
      case 'development':
      case 'rinkeby':
      case 'ropsten':
        await deployTestnet(deployer);
        break;
      default:
        throw("Unsupported network");
    }
  })
};