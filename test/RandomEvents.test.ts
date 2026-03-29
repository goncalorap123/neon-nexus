import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

/**
 * RandomEvents depends on CadenceRandomConsumer which calls the Cadence Arch
 * pre-compile at 0x0000000000000000000000010000000000000001. This pre-compile
 * only exists on the Flow EVM network and is not available on local Hardhat.
 *
 * Therefore, we can test:
 * - Contract deployment
 * - State reads on initial/default values
 * - That commitEvent reverts on local Hardhat (due to the missing pre-compile)
 * - revealEvent revert conditions for missing pending events
 *
 * We CANNOT test the full commit-reveal flow on local Hardhat.
 */
describe("RandomEvents", function () {
  async function deployFixture() {
    const [owner, agent1, agent2] = await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const randomEvents = await hre.viem.deployContract("RandomEvents");

    return { randomEvents, owner, agent1, agent2, publicClient };
  }

  describe("Deployment", function () {
    it("should deploy successfully", async function () {
      const { randomEvents } = await loadFixture(deployFixture);
      expect(randomEvents.address).to.be.a("string");
      expect(randomEvents.address).to.not.equal(
        "0x0000000000000000000000000000000000000000"
      );
    });
  });

  describe("Initial state", function () {
    it("should have no active request for any agent", async function () {
      const { randomEvents, agent1 } = await loadFixture(deployFixture);

      const requestId = await randomEvents.read.activeRequest([
        agent1.account.address,
      ]);
      expect(requestId).to.equal(0n);
    });

    it("should have no pending events for any request ID", async function () {
      const { randomEvents } = await loadFixture(deployFixture);

      const pending = await randomEvents.read.pendingEvents([0n]);
      expect(pending[0]).to.equal("0x0000000000000000000000000000000000000000"); // agent
      expect(pending[1]).to.equal(0); // eventType
      expect(pending[2]).to.equal(0n); // timestamp
    });
  });

  describe("commitEvent", function () {
    it("should revert on local Hardhat due to Cadence Arch pre-compile dependency", async function () {
      const { randomEvents, agent1 } = await loadFixture(deployFixture);

      // commitEvent calls _requestRandomness() which calls
      // CadenceArchUtils._flowBlockHeight() -- a staticcall to a pre-compile
      // that does not exist on local Hardhat. This should revert.
      await expect(
        randomEvents.write.commitEvent([agent1.account.address, 0])
      ).to.be.rejected;
    });

    it("should revert for all event types on local Hardhat", async function () {
      const { randomEvents, agent1 } = await loadFixture(deployFixture);

      // eventType 0 = gacha
      await expect(
        randomEvents.write.commitEvent([agent1.account.address, 0])
      ).to.be.rejected;

      // eventType 1 = disaster
      await expect(
        randomEvents.write.commitEvent([agent1.account.address, 1])
      ).to.be.rejected;

      // eventType 2 = trade_bonus
      await expect(
        randomEvents.write.commitEvent([agent1.account.address, 2])
      ).to.be.rejected;

      // eventType 3 = loot
      await expect(
        randomEvents.write.commitEvent([agent1.account.address, 3])
      ).to.be.rejected;
    });
  });

  describe("revealEvent", function () {
    it("should revert with 'No pending event' when agent has no active request", async function () {
      const { randomEvents, agent1 } = await loadFixture(deployFixture);

      // activeRequest[agent1] == 0, so require(requestId != 0) fails
      await expect(
        randomEvents.write.revealEvent([agent1.account.address])
      ).to.be.rejectedWith("No pending event");
    });

    it("should revert for multiple agents with no pending events", async function () {
      const { randomEvents, agent1, agent2 } =
        await loadFixture(deployFixture);

      await expect(
        randomEvents.write.revealEvent([agent1.account.address])
      ).to.be.rejectedWith("No pending event");

      await expect(
        randomEvents.write.revealEvent([agent2.account.address])
      ).to.be.rejectedWith("No pending event");
    });
  });

  describe("Access control", function () {
    it("should allow any caller to call commitEvent (no onlyOwner)", async function () {
      const { randomEvents, agent1 } = await loadFixture(deployFixture);

      // The function itself is not restricted, but it will revert due to
      // the Cadence Arch pre-compile. We verify it does NOT revert with
      // an access control error.
      try {
        await randomEvents.write.commitEvent([agent1.account.address, 0]);
        // If somehow it doesn't revert, that's fine too
      } catch (error: any) {
        // Should NOT be an access control error
        expect(error.message).to.not.include("OwnableUnauthorizedAccount");
        // It should be a pre-compile related revert
        expect(error.message).to.not.include("Ownable");
      }
    });

    it("should allow any caller to call revealEvent (no onlyOwner)", async function () {
      const { randomEvents, agent1 } = await loadFixture(deployFixture);

      // revealEvent reverts with "No pending event", not an access control error
      await expect(
        randomEvents.write.revealEvent([agent1.account.address])
      ).to.be.rejectedWith("No pending event");
    });
  });

  describe("State isolation", function () {
    it("should have independent activeRequest per agent", async function () {
      const { randomEvents, agent1, agent2 } =
        await loadFixture(deployFixture);

      const req1 = await randomEvents.read.activeRequest([
        agent1.account.address,
      ]);
      const req2 = await randomEvents.read.activeRequest([
        agent2.account.address,
      ]);

      expect(req1).to.equal(0n);
      expect(req2).to.equal(0n);
    });

    it("should have independent pendingEvents per request ID", async function () {
      const { randomEvents } = await loadFixture(deployFixture);

      const event0 = await randomEvents.read.pendingEvents([0n]);
      const event1 = await randomEvents.read.pendingEvents([1n]);
      const event99 = await randomEvents.read.pendingEvents([99n]);

      // All should be empty/default
      expect(event0[0]).to.equal(
        "0x0000000000000000000000000000000000000000"
      );
      expect(event1[0]).to.equal(
        "0x0000000000000000000000000000000000000000"
      );
      expect(event99[0]).to.equal(
        "0x0000000000000000000000000000000000000000"
      );
    });
  });
});
