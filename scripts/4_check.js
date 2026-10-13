// Read-only: show the current state of the proxy at any time (handy for screenshots).
const { ethers } = require("hardhat");
const { log, header, loadState, readImplementation, recipientAddress, addressLink, fmt } = require("./lib");

async function main() {
  const state = loadState();
  const [owner] = await ethers.getSigners();
  const token = await ethers.getContractAt("MyTokenV2", state.proxy);

  header("CHECK. Current proxy state");
  log("Proxy         :", state.proxy, " ", await addressLink(state.proxy));
  log("Implementation:", await readImplementation(state.proxy));
  log("Owner         :", await token.owner());
  log("Total supply  :", fmt(await token.totalSupply()));

  const holders = new Set([owner.address, ...Object.keys(state.balancesBeforeUpgrade || {})]);
  try { holders.add(await recipientAddress()); } catch {}
  for (const a of holders) log("Balance       :", a, "->", fmt(await token.balanceOf(a)));

  try {
    log("version()     :", await token.version());
  } catch {
    log("version()     : not available (proxy still points to V1)");
  }
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
