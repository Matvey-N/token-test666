const { expect } = require("chai");
const { ethers, upgrades } = require("hardhat");
const { loadFixture } = require("@nomicfoundation/hardhat-toolbox/network-helpers");

const IMPLEMENTATION_SLOT =
  "0x360894a13ba1a3210667c828492db98dca3e2076cc3735a920a3ca505d382bbc";

async function implementationOf(proxy) {
  const raw = await ethers.provider.getStorage(await proxy.getAddress(), IMPLEMENTATION_SLOT);
  return ethers.getAddress("0x" + raw.slice(-40));
}

describe("MyToken upgradeable (UUPS proxy)", function () {
  const SUPPLY = ethers.parseEther("1000000");

  async function deployV1Fixture() {
    const [owner, alice, bob] = await ethers.getSigners();

    const v1Impl = await ethers.deployContract("MyTokenV1");
    const initData = v1Impl.interface.encodeFunctionData("initialize", [owner.address, SUPPLY]);
    const proxy = await ethers.deployContract("MyTokenProxy", [await v1Impl.getAddress(), initData]);
    const token = await ethers.getContractAt("MyTokenV1", await proxy.getAddress());

    return { v1Impl, proxy, token, owner, alice, bob };
  }

  async function upgradedFixture() {
    const base = await deployV1Fixture();
    const { token, owner, alice, bob } = base;

    await token.mint(alice.address, ethers.parseEther("500"));
    await token.transfer(alice.address, ethers.parseEther("100"));
    await token.connect(alice).transfer(bob.address, ethers.parseEther("50"));

    const before = {
      owner: await token.balanceOf(owner.address),
      alice: await token.balanceOf(alice.address),
      bob: await token.balanceOf(bob.address),
      supply: await token.totalSupply(),
    };

    const v2Impl = await ethers.deployContract("MyTokenV2");
    await token.upgradeToAndCall(await v2Impl.getAddress(), "0x");
    const tokenV2 = await ethers.getContractAt("MyTokenV2", await token.getAddress());

    return { ...base, v2Impl, tokenV2, before };
  }

  describe("V1 behind the proxy", function () {
    it("initializes name, symbol, owner and supply through the proxy", async function () {
      const { token, proxy, v1Impl, owner } = await loadFixture(deployV1Fixture);
      expect(await token.name()).to.equal("MyToken");
      expect(await token.symbol()).to.equal("MTK");
      expect(await token.owner()).to.equal(owner.address);
      expect(await token.balanceOf(owner.address)).to.equal(SUPPLY);
      expect(await implementationOf(proxy)).to.equal(await v1Impl.getAddress());
    });

    it("keeps state in the proxy, not in the implementation", async function () {
      const { v1Impl, owner } = await loadFixture(deployV1Fixture);
      expect(await v1Impl.totalSupply()).to.equal(0n);
      expect(await v1Impl.balanceOf(owner.address)).to.equal(0n);
    });

    it("cannot be initialized a second time", async function () {
      const { token, alice } = await loadFixture(deployV1Fixture);
      await expect(token.initialize(alice.address, 1n)).to.be.revertedWithCustomError(
        token,
        "InvalidInitialization"
      );
    });

    it("implementation contract itself cannot be initialized", async function () {
      const { v1Impl, alice } = await loadFixture(deployV1Fixture);
      await expect(v1Impl.initialize(alice.address, 1n)).to.be.revertedWithCustomError(
        v1Impl,
        "InvalidInitialization"
      );
    });

    it("owner can mint through the proxy", async function () {
      const { token, alice } = await loadFixture(deployV1Fixture);
      const amount = ethers.parseEther("500");
      await expect(token.mint(alice.address, amount))
        .to.emit(token, "Transfer")
        .withArgs(ethers.ZeroAddress, alice.address, amount);
      expect(await token.balanceOf(alice.address)).to.equal(amount);
      expect(await token.totalSupply()).to.equal(SUPPLY + amount);
    });

    it("non-owner cannot mint", async function () {
      const { token, alice } = await loadFixture(deployV1Fixture);
      await expect(token.connect(alice).mint(alice.address, 1n))
        .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
        .withArgs(alice.address);
    });

    it("transfers tokens between accounts through the proxy", async function () {
      const { token, owner, alice } = await loadFixture(deployV1Fixture);
      const amount = ethers.parseEther("100");
      await expect(token.transfer(alice.address, amount)).to.changeTokenBalances(
        token,
        [owner, alice],
        [-amount, amount]
      );
    });

    it("rejects transfers above the balance", async function () {
      const { token, alice, bob } = await loadFixture(deployV1Fixture);
      await expect(token.connect(alice).transfer(bob.address, 1n))
        .to.be.revertedWithCustomError(token, "ERC20InsufficientBalance")
        .withArgs(alice.address, 0n, 1n);
    });

    it("has no version() function yet", async function () {
      const { token } = await loadFixture(deployV1Fixture);
      const probe = new ethers.Contract(
        await token.getAddress(),
        ["function version() view returns (string)"],
        ethers.provider
      );
      await expect(probe.version()).to.be.reverted;
    });
  });

  describe("Upgrade to V2", function () {
    it("V2 storage layout is compatible with V1", async function () {
      const V1 = await ethers.getContractFactory("MyTokenV1");
      const V2 = await ethers.getContractFactory("MyTokenV2");
      await upgrades.validateImplementation(V1, { kind: "uups" });
      await upgrades.validateUpgrade(V1, V2, { kind: "uups" });
    });

    it("only the owner can upgrade", async function () {
      const { token, alice } = await loadFixture(deployV1Fixture);
      const v2Impl = await ethers.deployContract("MyTokenV2");
      await expect(token.connect(alice).upgradeToAndCall(await v2Impl.getAddress(), "0x"))
        .to.be.revertedWithCustomError(token, "OwnableUnauthorizedAccount")
        .withArgs(alice.address);
    });

    it("emits Upgraded and points the proxy to V2", async function () {
      const { token, proxy } = await loadFixture(deployV1Fixture);
      const v2Impl = await ethers.deployContract("MyTokenV2");
      const v2Address = await v2Impl.getAddress();
      await expect(token.upgradeToAndCall(v2Address, "0x"))
        .to.emit(token, "Upgraded")
        .withArgs(v2Address);
      expect(await implementationOf(proxy)).to.equal(v2Address);
    });

    it("keeps balances, total supply and owner after the upgrade", async function () {
      const { tokenV2, owner, alice, bob, before } = await loadFixture(upgradedFixture);
      expect(await tokenV2.balanceOf(owner.address)).to.equal(before.owner);
      expect(await tokenV2.balanceOf(alice.address)).to.equal(before.alice);
      expect(await tokenV2.balanceOf(bob.address)).to.equal(before.bob);
      expect(await tokenV2.totalSupply()).to.equal(before.supply);
      expect(await tokenV2.owner()).to.equal(owner.address);
      expect(await tokenV2.name()).to.equal("MyToken");
    });

    it("version() returns V2 through the proxy", async function () {
      const { tokenV2 } = await loadFixture(upgradedFixture);
      expect(await tokenV2.version()).to.equal("V2");
    });

    it("mint and transfer still work after the upgrade", async function () {
      const { tokenV2, alice, bob, before } = await loadFixture(upgradedFixture);
      await tokenV2.mint(bob.address, ethers.parseEther("1"));
      await tokenV2.connect(alice).transfer(bob.address, ethers.parseEther("1"));
      expect(await tokenV2.balanceOf(bob.address)).to.equal(before.bob + ethers.parseEther("2"));
    });

    it("cannot be initialized again after the upgrade", async function () {
      const { tokenV2, alice } = await loadFixture(upgradedFixture);
      await expect(tokenV2.initialize(alice.address, 1n)).to.be.revertedWithCustomError(
        tokenV2,
        "InvalidInitialization"
      );
    });
  });
});
