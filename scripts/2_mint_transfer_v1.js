// Step 4: mint and transfer tokens through the proxy while it runs V1.
const { ethers } = require("hardhat");
const { log, header, txLink, loadState, saveState, recipientAddress, fmt, confirm, waitFor } = require("./lib");

async function main() {
  const state = loadState();
  const [owner] = await ethers.getSigners();
  const recipient = await recipientAddress();
  const token = await ethers.getContractAt("MyTokenV1", state.proxy);

  header("STEP 2. Mint and transfer on the V1 proxy");
  log("Proxy:    ", state.proxy);
  log("Owner:    ", owner.address);
  log("Recipient:", recipient);

  const ownerStart = await token.balanceOf(owner.address);
  const recipientStart = await token.balanceOf(recipient);
  const mintAmount = ethers.parseEther("500");
  const mintTx = await token.mint(recipient, mintAmount);
  await confirm(mintTx);
  log("");
  log(`mint(${recipient}, ${fmt(mintAmount)})`);
  log("  tx:", await txLink(mintTx.hash));

  const transferAmount = ethers.parseEther("100");
  const transferTx = await token.transfer(recipient, transferAmount);
  await confirm(transferTx);
  log("");
  log(`transfer(${recipient}, ${fmt(transferAmount)})  from owner`);
  log("  tx:", await txLink(transferTx.hash));

  // Make sure we read the state after both transactions
  await waitFor(
    () => token.balanceOf(recipient),
    (b) => b === recipientStart + mintAmount + transferAmount,
    "recipient balance"
  );
  await waitFor(() => token.balanceOf(owner.address), (b) => b === ownerStart - transferAmount, "owner balance");

  const balances = {
    [owner.address]: (await token.balanceOf(owner.address)).toString(),
    [recipient]: (await token.balanceOf(recipient)).toString(),
  };
  const totalSupply = (await token.totalSupply()).toString();

  log("");
  log("Balances on V1:");
  for (const [addr, bal] of Object.entries(balances)) log(" ", addr, "->", fmt(bal));
  log("  totalSupply ->", fmt(totalSupply));

  saveState({
    ...state,
    mintTx: mintTx.hash,
    transferTx: transferTx.hash,
    balancesBeforeUpgrade: balances,
    totalSupplyBeforeUpgrade: totalSupply,
  });
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
