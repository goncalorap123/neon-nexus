import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { parseUnits, getAddress, zeroAddress } from "viem";

describe("NeonNexus", function () {
  async function deployFixture() {
    const [owner, player, agentWallet, otherUser, anotherAgent] =
      await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const token = await hre.viem.deployContract("MockERC20", [
      "TestToken",
      "TT",
      18,
    ]);

    const nexus = await hre.viem.deployContract("NeonNexus", [token.address]);

    return {
      token,
      nexus,
      owner,
      player,
      agentWallet,
      otherUser,
      anotherAgent,
      publicClient,
    };
  }

  describe("Deployment", function () {
    it("should set the deposit token", async function () {
      const { nexus, token } = await loadFixture(deployFixture);
      expect(getAddress(await nexus.read.depositToken())).to.equal(
        getAddress(token.address)
      );
    });

    it("should set the deployer as owner", async function () {
      const { nexus, owner } = await loadFixture(deployFixture);
      expect(getAddress(await nexus.read.owner())).to.equal(
        getAddress(owner.account.address)
      );
    });

    it("should start with zero total deposits", async function () {
      const { nexus } = await loadFixture(deployFixture);
      expect(await nexus.read.totalDeposits()).to.equal(0n);
    });
  });

  describe("registerAgent", function () {
    it("should register an agent successfully", async function () {
      const { nexus, player, agentWallet, publicClient } =
        await loadFixture(deployFixture);

      const hash = await nexus.write.registerAgent([
        player.account.address,
        agentWallet.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const agent = await nexus.read.getAgent([agentWallet.account.address]);
      expect(getAddress(agent.wallet)).to.equal(
        getAddress(agentWallet.account.address)
      );
      expect(agent.deposit).to.equal(0n);
      expect(agent.yieldEarned).to.equal(0n);
      expect(agent.strategyType).to.equal(1);
      expect(agent.active).to.equal(true);
    });

    it("should set the playerAgent mapping", async function () {
      const { nexus, player, agentWallet, publicClient } =
        await loadFixture(deployFixture);

      const hash = await nexus.write.registerAgent([
        player.account.address,
        agentWallet.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const mapped = await nexus.read.playerAgent([player.account.address]);
      expect(getAddress(mapped)).to.equal(
        getAddress(agentWallet.account.address)
      );
    });

    it("should emit AgentCreated event", async function () {
      const { nexus, player, agentWallet, publicClient } =
        await loadFixture(deployFixture);

      const hash = await nexus.write.registerAgent([
        player.account.address,
        agentWallet.account.address,
      ]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      const events = await nexus.getEvents.AgentCreated();
      expect(events).to.have.lengthOf(1);
      expect(getAddress(events[0].args.player!)).to.equal(
        getAddress(player.account.address)
      );
      expect(getAddress(events[0].args.agentWallet!)).to.equal(
        getAddress(agentWallet.account.address)
      );
    });

    it("should revert if agent already exists", async function () {
      const { nexus, player, agentWallet, publicClient } =
        await loadFixture(deployFixture);

      const hash = await nexus.write.registerAgent([
        player.account.address,
        agentWallet.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      await expect(
        nexus.write.registerAgent([
          player.account.address,
          agentWallet.account.address,
        ])
      ).to.be.rejectedWith("Agent already exists");
    });

    it("should revert if called by non-owner", async function () {
      const { nexus, player, agentWallet } = await loadFixture(deployFixture);

      const nexusAsPlayer = await hre.viem.getContractAt(
        "NeonNexus",
        nexus.address,
        { client: { wallet: player } }
      );

      await expect(
        nexusAsPlayer.write.registerAgent([
          player.account.address,
          agentWallet.account.address,
        ])
      ).to.be.rejectedWith("OwnableUnauthorizedAccount");
    });
  });

  describe("deposit", function () {
    async function registeredAgentFixture() {
      const base = await deployFixture();
      const { nexus, player, agentWallet, token, owner, publicClient } = base;

      // Register agent
      const hash = await nexus.write.registerAgent([
        player.account.address,
        agentWallet.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Mint tokens to player and approve
      const amount = parseUnits("1000", 18);
      const mintHash = await token.write.mint([
        player.account.address,
        amount,
      ]);
      await publicClient.waitForTransactionReceipt({ hash: mintHash });

      const tokenAsPlayer = await hre.viem.getContractAt(
        "MockERC20",
        token.address,
        { client: { wallet: player } }
      );
      const approveHash = await tokenAsPlayer.write.approve([
        nexus.address,
        amount,
      ]);
      await publicClient.waitForTransactionReceipt({ hash: approveHash });

      const nexusAsPlayer = await hre.viem.getContractAt(
        "NeonNexus",
        nexus.address,
        { client: { wallet: player } }
      );

      return { ...base, nexusAsPlayer, tokenAsPlayer, amount };
    }

    it("should deposit tokens successfully", async function () {
      const { nexus, nexusAsPlayer, agentWallet, publicClient } =
        await loadFixture(registeredAgentFixture);

      const depositAmount = parseUnits("500", 18);
      const hash = await nexusAsPlayer.write.deposit([
        agentWallet.account.address,
        depositAmount,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const agent = await nexus.read.getAgent([agentWallet.account.address]);
      expect(agent.deposit).to.equal(depositAmount);
      expect(await nexus.read.totalDeposits()).to.equal(depositAmount);
    });

    it("should emit Deposited event", async function () {
      const { nexus, nexusAsPlayer, agentWallet, publicClient } =
        await loadFixture(registeredAgentFixture);

      const depositAmount = parseUnits("500", 18);
      const hash = await nexusAsPlayer.write.deposit([
        agentWallet.account.address,
        depositAmount,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const events = await nexus.getEvents.Deposited();
      expect(events).to.have.lengthOf(1);
      expect(getAddress(events[0].args.agentWallet!)).to.equal(
        getAddress(agentWallet.account.address)
      );
      expect(events[0].args.amount).to.equal(depositAmount);
    });

    it("should accumulate multiple deposits", async function () {
      const { nexus, nexusAsPlayer, agentWallet, publicClient } =
        await loadFixture(registeredAgentFixture);

      const first = parseUnits("200", 18);
      const second = parseUnits("300", 18);

      let hash = await nexusAsPlayer.write.deposit([
        agentWallet.account.address,
        first,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await nexusAsPlayer.write.deposit([
        agentWallet.account.address,
        second,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const agent = await nexus.read.getAgent([agentWallet.account.address]);
      expect(agent.deposit).to.equal(first + second);
      expect(await nexus.read.totalDeposits()).to.equal(first + second);
    });

    it("should revert if agent not active", async function () {
      const { nexus, player } = await loadFixture(deployFixture);

      const nexusAsPlayer = await hre.viem.getContractAt(
        "NeonNexus",
        nexus.address,
        { client: { wallet: player } }
      );

      await expect(
        nexusAsPlayer.write.deposit([player.account.address, 100n])
      ).to.be.rejectedWith("Agent not active");
    });

    it("should revert if transfer fails (no approval)", async function () {
      const { nexus, token, player, agentWallet, publicClient } =
        await loadFixture(deployFixture);

      // Register agent
      const hash = await nexus.write.registerAgent([
        player.account.address,
        agentWallet.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Mint tokens but do NOT approve
      const mintHash = await token.write.mint([
        player.account.address,
        parseUnits("1000", 18),
      ]);
      await publicClient.waitForTransactionReceipt({ hash: mintHash });

      const nexusAsPlayer = await hre.viem.getContractAt(
        "NeonNexus",
        nexus.address,
        { client: { wallet: player } }
      );

      await expect(
        nexusAsPlayer.write.deposit([
          agentWallet.account.address,
          parseUnits("100", 18),
        ])
      ).to.be.rejectedWith("ERC20InsufficientAllowance");
    });

    it("should allow deposit of zero amount", async function () {
      const { nexus, nexusAsPlayer, agentWallet, publicClient } =
        await loadFixture(registeredAgentFixture);

      const hash = await nexusAsPlayer.write.deposit([
        agentWallet.account.address,
        0n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const agent = await nexus.read.getAgent([agentWallet.account.address]);
      expect(agent.deposit).to.equal(0n);
    });
  });

  describe("withdraw", function () {
    async function depositedFixture() {
      const base = await deployFixture();
      const { nexus, player, agentWallet, token, publicClient } = base;

      // Register agent
      let hash = await nexus.write.registerAgent([
        player.account.address,
        agentWallet.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Mint, approve, and deposit
      const depositAmount = parseUnits("1000", 18);
      hash = await token.write.mint([player.account.address, depositAmount]);
      await publicClient.waitForTransactionReceipt({ hash });

      const tokenAsPlayer = await hre.viem.getContractAt(
        "MockERC20",
        token.address,
        { client: { wallet: player } }
      );
      hash = await tokenAsPlayer.write.approve([nexus.address, depositAmount]);
      await publicClient.waitForTransactionReceipt({ hash });

      const nexusAsPlayer = await hre.viem.getContractAt(
        "NeonNexus",
        nexus.address,
        { client: { wallet: player } }
      );
      hash = await nexusAsPlayer.write.deposit([
        agentWallet.account.address,
        depositAmount,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      return { ...base, nexusAsPlayer, tokenAsPlayer, depositAmount };
    }

    it("should withdraw tokens successfully", async function () {
      const {
        nexus,
        nexusAsPlayer,
        agentWallet,
        player,
        token,
        publicClient,
        depositAmount,
      } = await loadFixture(depositedFixture);

      const withdrawAmount = parseUnits("400", 18);
      const hash = await nexusAsPlayer.write.withdraw([
        agentWallet.account.address,
        withdrawAmount,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const agent = await nexus.read.getAgent([agentWallet.account.address]);
      expect(agent.deposit).to.equal(depositAmount - withdrawAmount);
      expect(await nexus.read.totalDeposits()).to.equal(
        depositAmount - withdrawAmount
      );

      const balance = await token.read.balanceOf([player.account.address]);
      expect(balance).to.equal(withdrawAmount);
    });

    it("should emit Withdrawn event", async function () {
      const { nexus, nexusAsPlayer, agentWallet, publicClient } =
        await loadFixture(depositedFixture);

      const withdrawAmount = parseUnits("400", 18);
      const hash = await nexusAsPlayer.write.withdraw([
        agentWallet.account.address,
        withdrawAmount,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const events = await nexus.getEvents.Withdrawn();
      expect(events).to.have.lengthOf(1);
      expect(getAddress(events[0].args.agentWallet!)).to.equal(
        getAddress(agentWallet.account.address)
      );
      expect(events[0].args.amount).to.equal(withdrawAmount);
    });

    it("should allow full withdrawal", async function () {
      const { nexus, nexusAsPlayer, agentWallet, publicClient, depositAmount } =
        await loadFixture(depositedFixture);

      const hash = await nexusAsPlayer.write.withdraw([
        agentWallet.account.address,
        depositAmount,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const agent = await nexus.read.getAgent([agentWallet.account.address]);
      expect(agent.deposit).to.equal(0n);
      expect(await nexus.read.totalDeposits()).to.equal(0n);
    });

    it("should revert if insufficient deposit", async function () {
      const { nexusAsPlayer, agentWallet, depositAmount } =
        await loadFixture(depositedFixture);

      await expect(
        nexusAsPlayer.write.withdraw([
          agentWallet.account.address,
          depositAmount + 1n,
        ])
      ).to.be.rejectedWith("Insufficient deposit");
    });

    it("should revert if agent not active", async function () {
      const { nexus, otherUser } = await loadFixture(deployFixture);

      const nexusAsOther = await hre.viem.getContractAt(
        "NeonNexus",
        nexus.address,
        { client: { wallet: otherUser } }
      );

      await expect(
        nexusAsOther.write.withdraw([otherUser.account.address, 100n])
      ).to.be.rejectedWith("Agent not active");
    });

    it("should allow withdrawal of zero amount", async function () {
      const { nexus, nexusAsPlayer, agentWallet, publicClient, depositAmount } =
        await loadFixture(depositedFixture);

      const hash = await nexusAsPlayer.write.withdraw([
        agentWallet.account.address,
        0n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const agent = await nexus.read.getAgent([agentWallet.account.address]);
      expect(agent.deposit).to.equal(depositAmount);
    });
  });

  describe("distributeYield", function () {
    async function registeredFixture() {
      const base = await deployFixture();
      const { nexus, player, agentWallet, publicClient } = base;

      const hash = await nexus.write.registerAgent([
        player.account.address,
        agentWallet.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      return base;
    }

    it("should distribute yield to an agent", async function () {
      const { nexus, agentWallet, publicClient } =
        await loadFixture(registeredFixture);

      const yieldAmount = parseUnits("50", 18);
      const hash = await nexus.write.distributeYield([
        agentWallet.account.address,
        yieldAmount,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const agent = await nexus.read.getAgent([agentWallet.account.address]);
      expect(agent.yieldEarned).to.equal(yieldAmount);
    });

    it("should update lastHarvest timestamp", async function () {
      const { nexus, agentWallet, publicClient } =
        await loadFixture(registeredFixture);

      const hash = await nexus.write.distributeYield([
        agentWallet.account.address,
        100n,
      ]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      const block = await publicClient.getBlock({
        blockNumber: receipt.blockNumber,
      });

      const agent = await nexus.read.getAgent([agentWallet.account.address]);
      expect(agent.lastHarvest).to.equal(block.timestamp);
    });

    it("should accumulate yield over multiple distributions", async function () {
      const { nexus, agentWallet, publicClient } =
        await loadFixture(registeredFixture);

      const first = 100n;
      const second = 200n;

      let hash = await nexus.write.distributeYield([
        agentWallet.account.address,
        first,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await nexus.write.distributeYield([
        agentWallet.account.address,
        second,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const agent = await nexus.read.getAgent([agentWallet.account.address]);
      expect(agent.yieldEarned).to.equal(first + second);
    });

    it("should emit YieldHarvested event", async function () {
      const { nexus, agentWallet, publicClient } =
        await loadFixture(registeredFixture);

      const yieldAmount = 500n;
      const hash = await nexus.write.distributeYield([
        agentWallet.account.address,
        yieldAmount,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const events = await nexus.getEvents.YieldHarvested();
      expect(events).to.have.lengthOf(1);
      expect(getAddress(events[0].args.agentWallet!)).to.equal(
        getAddress(agentWallet.account.address)
      );
      expect(events[0].args.amount).to.equal(yieldAmount);
    });

    it("should revert if agent not active", async function () {
      const { nexus, otherUser } = await loadFixture(deployFixture);

      await expect(
        nexus.write.distributeYield([otherUser.account.address, 100n])
      ).to.be.rejectedWith("Agent not active");
    });

    it("should revert if called by non-owner", async function () {
      const { nexus, player, agentWallet } =
        await loadFixture(registeredFixture);

      const nexusAsPlayer = await hre.viem.getContractAt(
        "NeonNexus",
        nexus.address,
        { client: { wallet: player } }
      );

      await expect(
        nexusAsPlayer.write.distributeYield([
          agentWallet.account.address,
          100n,
        ])
      ).to.be.rejectedWith("OwnableUnauthorizedAccount");
    });

    it("should allow zero yield distribution", async function () {
      const { nexus, agentWallet, publicClient } =
        await loadFixture(registeredFixture);

      const hash = await nexus.write.distributeYield([
        agentWallet.account.address,
        0n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const agent = await nexus.read.getAgent([agentWallet.account.address]);
      expect(agent.yieldEarned).to.equal(0n);
    });
  });

  describe("setStrategy", function () {
    async function registeredFixture() {
      const base = await deployFixture();
      const { nexus, player, agentWallet, publicClient } = base;

      const hash = await nexus.write.registerAgent([
        player.account.address,
        agentWallet.account.address,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      return base;
    }

    it("should set strategy to 0", async function () {
      const { nexus, agentWallet, publicClient } =
        await loadFixture(registeredFixture);

      const hash = await nexus.write.setStrategy([
        agentWallet.account.address,
        0,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const agent = await nexus.read.getAgent([agentWallet.account.address]);
      expect(agent.strategyType).to.equal(0);
    });

    it("should set strategy to 2", async function () {
      const { nexus, agentWallet, publicClient } =
        await loadFixture(registeredFixture);

      const hash = await nexus.write.setStrategy([
        agentWallet.account.address,
        2,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const agent = await nexus.read.getAgent([agentWallet.account.address]);
      expect(agent.strategyType).to.equal(2);
    });

    it("should emit StrategyUpdated event", async function () {
      const { nexus, agentWallet, publicClient } =
        await loadFixture(registeredFixture);

      const hash = await nexus.write.setStrategy([
        agentWallet.account.address,
        2,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const events = await nexus.getEvents.StrategyUpdated();
      expect(events).to.have.lengthOf(1);
      expect(getAddress(events[0].args.agentWallet!)).to.equal(
        getAddress(agentWallet.account.address)
      );
      expect(events[0].args.strategyType).to.equal(2);
    });

    it("should revert for invalid strategy (3)", async function () {
      const { nexus, agentWallet } = await loadFixture(registeredFixture);

      await expect(
        nexus.write.setStrategy([agentWallet.account.address, 3])
      ).to.be.rejectedWith("Invalid strategy");
    });

    it("should revert if agent not active", async function () {
      const { nexus, otherUser } = await loadFixture(deployFixture);

      await expect(
        nexus.write.setStrategy([otherUser.account.address, 0])
      ).to.be.rejectedWith("Agent not active");
    });

    it("should allow anyone to set strategy (not just owner)", async function () {
      const { nexus, player, agentWallet, publicClient } =
        await loadFixture(registeredFixture);

      const nexusAsPlayer = await hre.viem.getContractAt(
        "NeonNexus",
        nexus.address,
        { client: { wallet: player } }
      );

      const hash = await nexusAsPlayer.write.setStrategy([
        agentWallet.account.address,
        2,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const agent = await nexus.read.getAgent([agentWallet.account.address]);
      expect(agent.strategyType).to.equal(2);
    });
  });

  describe("getAgent", function () {
    it("should return empty agent for unregistered address", async function () {
      const { nexus, otherUser } = await loadFixture(deployFixture);

      const agent = await nexus.read.getAgent([otherUser.account.address]);
      expect(agent.wallet).to.equal(zeroAddress);
      expect(agent.deposit).to.equal(0n);
      expect(agent.yieldEarned).to.equal(0n);
      expect(agent.strategyType).to.equal(0);
      expect(agent.active).to.equal(false);
    });
  });
});
