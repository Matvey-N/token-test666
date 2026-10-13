// Shared helpers: saved addresses, log file, explorer links.
const fs = require("fs");
const path = require("path");
const { ethers, network } = require("hardhat");

const ROOT = path.join(__dirname, "..");
const STATE_FILE = path.join(ROOT, "deployments", `${network.name}.json`);
const LOG_FILE = path.join(ROOT, "logs", `${network.name}.log`);

// ERC-1967 implementation slot: bytes32(uint256(keccak256("eip1967.proxy.implementation")) - 1)
const IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

const EXPLORERS = {
  11155111: "https://sepolia.etherscan.io",
  17000: "https://holesky.etherscan.io",
  560048: "https://hoodi.etherscan.io",
  97: "https://testnet.bscscan.com",
  80002: "https://amoy.polygonscan.com",
  43113: "https://testnet.snowtrace.io",
  421614: "https://sepolia.arbiscan.io",
  11155420: "https://sepolia-optimism.etherscan.io",
  84532: "https://sepolia.basescan.org",
};

function log(...args) {
  const line = args.join(" ");
  console.log(line);
  fs.mkdirSync(path.dirname(LOG_FILE), { recursive: true });
  fs.appendFileSync(LOG_FILE, line + "\n");
}

function header(title) {
  log("");
  log("=".repeat(70));
  log(`${title}  |  network: ${network.name}  |  ${new Date().toISOString()}`);
  log("=".repeat(70));
}

async function explorer() {
  const { chainId } = await ethers.provider.getNetwork();
  return EXPLORERS[Number(chainId)] || process.env.EXPLORER_URL || null;
}

async function txLink(hash) {
  const base = await explorer();
  return base ? `${base}/tx/${hash}` : hash;
}

async function addressLink(address) {
  const base = await explorer();
  return base ? `${base}/address/${address}` : address;
}

function loadState() {
  if (!fs.existsSync(STATE_FILE)) {
    throw new Error(
      `No ${path.relative(ROOT, STATE_FILE)} found. Run scripts/1_deploy_v1.js on this network first.`
    );
  }
  return JSON.parse(fs.readFileSync(STATE_FILE, "utf8"));
}

function saveState(state) {
  fs.mkdirSync(path.dirname(STATE_FILE), { recursive: true });
  fs.writeFileSync(STATE_FILE, JSON.stringify(state, null, 2) + "\n");
}

async function readImplementation(proxyAddress) {
  const raw = await ethers.provider.getStorage(proxyAddress, IMPLEMENTATION_SLOT);
  return ethers.getAddress("0x" + raw.slice(-40));
}

// Second account that receives tokens: RECIPIENT env var (e.g. your MetaMask Account 2).
// On the local Hardhat network it falls back to the second built-in account.
async function recipientAddress() {
  if (process.env.RECIPIENT) return ethers.getAddress(process.env.RECIPIENT);
  const signers = await ethers.getSigners();
  if (signers.length > 1) return signers[1].address;
  throw new Error("Set RECIPIENT to the address of your second MetaMask account.");
}

const fmt = (wei) => `${ethers.formatEther(wei)} MTK`;

// Public testnet RPCs are load-balanced: a read sent right after a transaction
// can hit a node that has not seen the new block yet. So on live networks we
// wait for extra confirmations and retry reads until the expected value shows up.
const LOCAL = ["hardhat", "localhost"].includes(network.name);
const CONFIRMATIONS = LOCAL ? 1 : 2;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function confirm(tx) {
  return tx.wait(CONFIRMATIONS);
}

async function deployed(contract) {
  await contract.waitForDeployment();
  await contract.deploymentTransaction().wait(CONFIRMATIONS);
  return contract;
}

// Retries `read` until `isReady(value)` is true (or gives up after ~2 minutes).
async function waitFor(read, isReady, what) {
  for (let i = 0; i < 40; i++) {
    try {
      const value = await read();
      if (isReady(value)) return value;
    } catch {}
    if (i === 0) console.log(`  waiting for the RPC node to catch up (${what}) ...`);
    await sleep(3000);
  }
  throw new Error(`RPC node did not return the expected ${what}. Run the script again in a minute.`);
}

async function waitForImplementation(proxyAddress, expected) {
  return waitFor(
    () => readImplementation(proxyAddress),
    (impl) => impl.toLowerCase() === expected.toLowerCase(),
    "implementation address"
  );
}

module.exports = {
  log, header, txLink, addressLink, loadState, saveState,
  readImplementation, recipientAddress, fmt, STATE_FILE, LOG_FILE,
  confirm, deployed, waitFor, waitForImplementation, sleep,
};
