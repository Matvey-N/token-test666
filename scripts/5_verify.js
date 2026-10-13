// Optional: verify V1, V2 and the proxy on the block explorer (Etherscan family).
// Needs a free API key: npx hardhat vars set ETHERSCAN_API_KEY
// After verification the explorer shows the source code and offers
// "Read as Proxy" / "Write as Proxy" on the proxy page, where version() can be called.
const hre = require("hardhat");
const { loadState } = require("./lib");

async function verify(label, address, constructorArguments = [], contract) {
  console.log(`\nVerifying ${label} at ${address} ...`);
  try {
    await hre.run("verify:verify", { address, constructorArguments, contract });
  } catch (e) {
    if (/already verified/i.test(e.message)) console.log("Already verified.");
    else console.log(`Could not verify ${label}: ${e.message}`);
  }
}

async function main() {
  const s = loadState();
  await verify("MyTokenV1", s.implementationV1, [], "contracts/MyTokenV1.sol:MyTokenV1");
  if (s.implementationV2) {
    await verify("MyTokenV2", s.implementationV2, [], "contracts/MyTokenV2.sol:MyTokenV2");
  }
  await verify(
    "MyTokenProxy",
    s.proxy,
    [s.implementationV1, s.proxyInitData],
    "contracts/MyTokenProxy.sol:MyTokenProxy"
  );
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
