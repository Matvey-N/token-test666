// Steps 5-7: deploy MyTokenV2, upgrade the proxy, validate balances and version().
const { ethers } = require("hardhat");
const {
  log, header, txLink, loadState, saveState, readImplementation, fmt,
  confirm, deployed, waitForImplementation, waitFor,
} = require("./lib");

async function main() {
  const state = loadState();
  const [owner] = await ethers.getSigners();

  header("STEP 3. Upgrade the proxy to MyTokenV2");

  // Snapshot right before the upgrade (works even if step 2 was done in MetaMask)
  const tokenV1 = await ethers.getContractAt("MyTokenV1", state.proxy);
  const holders = Object.keys(state.balancesBeforeUpgrade || { [owner.address]: "0" });
  if (process.env.RECIPIENT && !holders.includes(process.env.RECIPIENT)) holders.push(process.env.RECIPIENT);
  const before = {};
  for (const a of holders) before[a] = await tokenV1.balanceOf(a);
  const supplyBefore = await tokenV1.totalSupply();
  const implBefore = await readImplementation(state.proxy);

  // version() does not exist in V1: calling it through the proxy must fail
  const probe = new ethers.Contract(state.proxy, ["function version() view returns (string)"], ethers.provider);
  let v1Version;
  try {
    v1Version = await probe.version();
  } catch {
    v1Version = "(reverts: function does not exist in V1)";
  }
  log("Implementation before:", implBefore);
  log("version() before     :", v1Version);

  // 1. Deploy the new logic contract
  const v2 = await deployed(await ethers.deployContract("MyTokenV2"));
  const v2Address = await v2.getAddress();
  log("");
  log("MyTokenV2 implementation:", v2Address);
  log("  deploy tx:", await txLink(v2.deploymentTransaction().hash));

  // 2. Upgrade: call upgradeToAndCall on the proxy (UUPS, owner only)
  const upgradeTx = await tokenV1.upgradeToAndCall(v2Address, "0x");
  await confirm(upgradeTx);
  log("");
  log("upgradeToAndCall(", v2Address, ") through the proxy");
  log("  upgrade tx:", await txLink(upgradeTx.hash));

  // Save right away, so a failed check below does not lose the addresses
  saveState({
    ...state,
    implementationV2: v2Address,
    deployTxV2: v2.deploymentTransaction().hash,
    upgradeTx: upgradeTx.hash,
  });

  // 3. Validate
  const tokenV2 = await ethers.getContractAt("MyTokenV2", state.proxy);
  const implAfter = await waitForImplementation(state.proxy, v2Address);
  log("");
  log("Validation:");
  log("  proxy address (unchanged):", state.proxy);
  log("  implementation after     :", implAfter, implAfter === v2Address ? "OK (= V2)" : "MISMATCH");

  let allSame = true;
  log("");
  log("  Balances before -> after upgrade:");
  for (const a of holders) {
    const after = await tokenV2.balanceOf(a);
    const same = after === before[a];
    allSame &&= same;
    log(`   ${a}: ${fmt(before[a])} -> ${fmt(after)} ${same ? "OK" : "CHANGED!"}`);
  }
  const supplyAfter = await tokenV2.totalSupply();
  allSame &&= supplyAfter === supplyBefore;
  log(`   totalSupply: ${fmt(supplyBefore)} -> ${fmt(supplyAfter)} ${supplyAfter === supplyBefore ? "OK" : "CHANGED!"}`);
  log("  owner after              :", await tokenV2.owner());
  log("");
  log("  version() after upgrade  :", await waitFor(() => tokenV2.version(), (v) => v === "V2", "version()"));
  log("");
  log(allSame ? "RESULT: upgrade successful, balances unchanged." : "RESULT: balances changed, check the log!");

}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
