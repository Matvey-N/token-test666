// Step 1-3: deploy MyTokenV1 (logic contract) and MyTokenProxy pointing to it.
const { ethers, network } = require("hardhat");
const {
  log, header, txLink, addressLink, saveState, readImplementation, fmt,
  deployed, waitForImplementation, waitFor,
} = require("./lib");

async function main() {
  const [deployer] = await ethers.getSigners();
  const initialSupply = ethers.parseEther("1000000"); // 1,000,000 MTK

  header("STEP 1. Deploy MyTokenV1 implementation + MyTokenProxy");
  log("Deployer (owner):", deployer.address);

  // 1. Logic contract
  const v1 = await deployed(await ethers.deployContract("MyTokenV1"));
  const v1Address = await v1.getAddress();
  log("");
  log("MyTokenV1 implementation:", v1Address);
  log("  deploy tx:", await txLink(v1.deploymentTransaction().hash));

  // 2. Proxy, initialized in the same transaction
  const initData = v1.interface.encodeFunctionData("initialize", [deployer.address, initialSupply]);
  const proxy = await deployed(await ethers.deployContract("MyTokenProxy", [v1Address, initData]));
  const proxyAddress = await proxy.getAddress();
  log("");
  log("MyTokenProxy (token address):", proxyAddress);
  log("  deploy tx:", await txLink(proxy.deploymentTransaction().hash));

  // Save addresses right away, so later steps work even if a check below fails
  saveState({
    network: network.name,
    proxy: proxyAddress,
    implementationV1: v1Address,
    deployTxV1: v1.deploymentTransaction().hash,
    deployTxProxy: proxy.deploymentTransaction().hash,
    proxyInitData: initData, // constructor argument, needed for explorer verification
  });

  await waitForImplementation(proxyAddress, v1Address);

  // 3. Check: talk to the proxy using the V1 ABI
  const token = await ethers.getContractAt("MyTokenV1", proxyAddress);
  log("");
  log("Check through the proxy:");
  log("  implementation slot ->", await readImplementation(proxyAddress));
  await waitFor(() => token.totalSupply(), (v) => v === initialSupply, "total supply");
  log("  name / symbol       ->", await token.name(), "/", await token.symbol());
  log("  owner               ->", await token.owner());
  log("  totalSupply         ->", fmt(await token.totalSupply()));
  log("  balance of deployer ->", fmt(await token.balanceOf(deployer.address)));
  log("");
  log("Token page:", await addressLink(proxyAddress));
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
