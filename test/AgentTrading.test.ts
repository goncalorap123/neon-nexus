import { loadFixture } from "@nomicfoundation/hardhat-network-helpers";
import { expect } from "chai";
import hre from "hardhat";
import { getAddress } from "viem";

describe("AgentTrading", function () {
  async function deployFixture() {
    const [owner, seller, buyer, otherUser] =
      await hre.viem.getWalletClients();
    const publicClient = await hre.viem.getPublicClient();

    const trading = await hre.viem.deployContract("AgentTrading");

    return { trading, owner, seller, buyer, otherUser, publicClient };
  }

  describe("Deployment", function () {
    it("should set the deployer as owner", async function () {
      const { trading, owner } = await loadFixture(deployFixture);
      expect(getAddress(await trading.read.owner())).to.equal(
        getAddress(owner.account.address)
      );
    });

    it("should start with nextOfferId at 0", async function () {
      const { trading } = await loadFixture(deployFixture);
      expect(await trading.read.nextOfferId()).to.equal(0n);
    });
  });

  describe("mintResources", function () {
    it("should mint resources to an agent", async function () {
      const { trading, seller, publicClient } =
        await loadFixture(deployFixture);

      const hash = await trading.write.mintResources([
        seller.account.address,
        0, // wood
        1000n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const balance = await trading.read.agentResources([
        seller.account.address,
        0,
      ]);
      expect(balance).to.equal(1000n);
    });

    it("should accumulate minted resources", async function () {
      const { trading, seller, publicClient } =
        await loadFixture(deployFixture);

      let hash = await trading.write.mintResources([
        seller.account.address,
        1,
        500n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await trading.write.mintResources([
        seller.account.address,
        1,
        300n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const balance = await trading.read.agentResources([
        seller.account.address,
        1,
      ]);
      expect(balance).to.equal(800n);
    });

    it("should mint different resource types independently", async function () {
      const { trading, seller, publicClient } =
        await loadFixture(deployFixture);

      let hash = await trading.write.mintResources([
        seller.account.address,
        0,
        100n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await trading.write.mintResources([
        seller.account.address,
        1,
        200n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await trading.write.mintResources([
        seller.account.address,
        2,
        300n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await trading.write.mintResources([
        seller.account.address,
        3,
        400n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      expect(
        await trading.read.agentResources([seller.account.address, 0])
      ).to.equal(100n);
      expect(
        await trading.read.agentResources([seller.account.address, 1])
      ).to.equal(200n);
      expect(
        await trading.read.agentResources([seller.account.address, 2])
      ).to.equal(300n);
      expect(
        await trading.read.agentResources([seller.account.address, 3])
      ).to.equal(400n);
    });

    it("should revert if called by non-owner", async function () {
      const { trading, seller } = await loadFixture(deployFixture);

      const tradingAsSeller = await hre.viem.getContractAt(
        "AgentTrading",
        trading.address,
        { client: { wallet: seller } }
      );

      await expect(
        tradingAsSeller.write.mintResources([seller.account.address, 0, 100n])
      ).to.be.rejectedWith("OwnableUnauthorizedAccount");
    });

    it("should allow minting zero quantity", async function () {
      const { trading, seller, publicClient } =
        await loadFixture(deployFixture);

      const hash = await trading.write.mintResources([
        seller.account.address,
        0,
        0n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const balance = await trading.read.agentResources([
        seller.account.address,
        0,
      ]);
      expect(balance).to.equal(0n);
    });
  });

  describe("createOffer", function () {
    async function mintedFixture() {
      const base = await deployFixture();
      const { trading, seller, publicClient } = base;

      // Mint resources to seller
      const hash = await trading.write.mintResources([
        seller.account.address,
        0, // wood
        1000n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      return base;
    }

    it("should create an offer successfully", async function () {
      const { trading, seller, publicClient } =
        await loadFixture(mintedFixture);

      const hash = await trading.write.createOffer([
        seller.account.address,
        0,
        500n,
        10n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const offer = await trading.read.offers([0n]);
      expect(getAddress(offer[0])).to.equal(
        getAddress(seller.account.address)
      ); // seller
      expect(offer[1]).to.equal(0); // resourceType
      expect(offer[2]).to.equal(500n); // quantity
      expect(offer[3]).to.equal(10n); // pricePerUnit
      expect(offer[4]).to.equal(true); // active
    });

    it("should deduct resources from seller", async function () {
      const { trading, seller, publicClient } =
        await loadFixture(mintedFixture);

      const hash = await trading.write.createOffer([
        seller.account.address,
        0,
        500n,
        10n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const balance = await trading.read.agentResources([
        seller.account.address,
        0,
      ]);
      expect(balance).to.equal(500n); // 1000 - 500
    });

    it("should increment nextOfferId", async function () {
      const { trading, seller, publicClient } =
        await loadFixture(mintedFixture);

      const hash = await trading.write.createOffer([
        seller.account.address,
        0,
        100n,
        10n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      expect(await trading.read.nextOfferId()).to.equal(1n);
    });

    it("should emit OfferCreated event", async function () {
      const { trading, seller, publicClient } =
        await loadFixture(mintedFixture);

      const hash = await trading.write.createOffer([
        seller.account.address,
        0,
        500n,
        10n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const events = await trading.getEvents.OfferCreated();
      expect(events).to.have.lengthOf(1);
      expect(events[0].args.offerId).to.equal(0n);
      expect(getAddress(events[0].args.seller!)).to.equal(
        getAddress(seller.account.address)
      );
      expect(events[0].args.resourceType).to.equal(0);
      expect(events[0].args.quantity).to.equal(500n);
      expect(events[0].args.price).to.equal(10n);
    });

    it("should create multiple offers with sequential IDs", async function () {
      const { trading, seller, publicClient } =
        await loadFixture(mintedFixture);

      let hash = await trading.write.createOffer([
        seller.account.address,
        0,
        200n,
        5n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await trading.write.createOffer([
        seller.account.address,
        0,
        300n,
        8n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      expect(await trading.read.nextOfferId()).to.equal(2n);

      const offer0 = await trading.read.offers([0n]);
      expect(offer0[2]).to.equal(200n); // quantity

      const offer1 = await trading.read.offers([1n]);
      expect(offer1[2]).to.equal(300n); // quantity
    });

    it("should revert if insufficient resources", async function () {
      const { trading, seller } = await loadFixture(mintedFixture);

      await expect(
        trading.write.createOffer([seller.account.address, 0, 1001n, 10n])
      ).to.be.rejectedWith("Insufficient resources");
    });

    it("should revert if no resources at all", async function () {
      const { trading, seller } = await loadFixture(deployFixture);

      await expect(
        trading.write.createOffer([seller.account.address, 0, 1n, 10n])
      ).to.be.rejectedWith("Insufficient resources");
    });

    it("should revert if called by non-owner", async function () {
      const { trading, seller } = await loadFixture(mintedFixture);

      const tradingAsSeller = await hre.viem.getContractAt(
        "AgentTrading",
        trading.address,
        { client: { wallet: seller } }
      );

      await expect(
        tradingAsSeller.write.createOffer([
          seller.account.address,
          0,
          100n,
          10n,
        ])
      ).to.be.rejectedWith("OwnableUnauthorizedAccount");
    });

    it("should allow creating an offer with zero price", async function () {
      const { trading, seller, publicClient } =
        await loadFixture(mintedFixture);

      const hash = await trading.write.createOffer([
        seller.account.address,
        0,
        100n,
        0n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const offer = await trading.read.offers([0n]);
      expect(offer[3]).to.equal(0n); // pricePerUnit
      expect(offer[4]).to.equal(true); // active
    });
  });

  describe("executeTrade", function () {
    async function offerFixture() {
      const base = await deployFixture();
      const { trading, seller, publicClient } = base;

      // Mint resources and create offer
      let hash = await trading.write.mintResources([
        seller.account.address,
        0,
        1000n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await trading.write.createOffer([
        seller.account.address,
        0,
        500n,
        10n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      return { ...base, offerId: 0n };
    }

    it("should execute a partial trade", async function () {
      const { trading, buyer, publicClient, offerId } =
        await loadFixture(offerFixture);

      const hash = await trading.write.executeTrade([
        buyer.account.address,
        offerId,
        200n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Buyer should have resources
      const buyerBalance = await trading.read.agentResources([
        buyer.account.address,
        0,
      ]);
      expect(buyerBalance).to.equal(200n);

      // Offer quantity should be reduced
      const offer = await trading.read.offers([offerId]);
      expect(offer[2]).to.equal(300n); // 500 - 200
      expect(offer[4]).to.equal(true); // still active
    });

    it("should execute a full trade and deactivate offer", async function () {
      const { trading, buyer, publicClient, offerId } =
        await loadFixture(offerFixture);

      const hash = await trading.write.executeTrade([
        buyer.account.address,
        offerId,
        500n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const buyerBalance = await trading.read.agentResources([
        buyer.account.address,
        0,
      ]);
      expect(buyerBalance).to.equal(500n);

      const offer = await trading.read.offers([offerId]);
      expect(offer[2]).to.equal(0n);
      expect(offer[4]).to.equal(false); // deactivated
    });

    it("should emit TradeExecuted event", async function () {
      const { trading, buyer, publicClient, offerId } =
        await loadFixture(offerFixture);

      const hash = await trading.write.executeTrade([
        buyer.account.address,
        offerId,
        200n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const events = await trading.getEvents.TradeExecuted();
      expect(events).to.have.lengthOf(1);
      expect(events[0].args.offerId).to.equal(offerId);
      expect(getAddress(events[0].args.buyer!)).to.equal(
        getAddress(buyer.account.address)
      );
      expect(events[0].args.quantity).to.equal(200n);
    });

    it("should allow multiple partial trades on same offer", async function () {
      const { trading, buyer, otherUser, publicClient, offerId } =
        await loadFixture(offerFixture);

      let hash = await trading.write.executeTrade([
        buyer.account.address,
        offerId,
        200n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await trading.write.executeTrade([
        otherUser.account.address,
        offerId,
        100n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      expect(
        await trading.read.agentResources([buyer.account.address, 0])
      ).to.equal(200n);
      expect(
        await trading.read.agentResources([otherUser.account.address, 0])
      ).to.equal(100n);

      const offer = await trading.read.offers([offerId]);
      expect(offer[2]).to.equal(200n); // 500 - 200 - 100
      expect(offer[4]).to.equal(true);
    });

    it("should revert if offer not active", async function () {
      const { trading, buyer, publicClient, offerId } =
        await loadFixture(offerFixture);

      // Buy all to deactivate
      const hash = await trading.write.executeTrade([
        buyer.account.address,
        offerId,
        500n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      await expect(
        trading.write.executeTrade([buyer.account.address, offerId, 1n])
      ).to.be.rejectedWith("Offer not active");
    });

    it("should revert if insufficient quantity in offer", async function () {
      const { trading, buyer } = await loadFixture(offerFixture);

      await expect(
        trading.write.executeTrade([buyer.account.address, 0n, 501n])
      ).to.be.rejectedWith("Insufficient quantity");
    });

    it("should revert if offer does not exist (defaults to inactive)", async function () {
      const { trading, buyer } = await loadFixture(offerFixture);

      await expect(
        trading.write.executeTrade([buyer.account.address, 999n, 1n])
      ).to.be.rejectedWith("Offer not active");
    });

    it("should revert if called by non-owner", async function () {
      const { trading, buyer } = await loadFixture(offerFixture);

      const tradingAsBuyer = await hre.viem.getContractAt(
        "AgentTrading",
        trading.address,
        { client: { wallet: buyer } }
      );

      await expect(
        tradingAsBuyer.write.executeTrade([buyer.account.address, 0n, 100n])
      ).to.be.rejectedWith("OwnableUnauthorizedAccount");
    });
  });

  describe("cancelOffer", function () {
    async function offerFixture() {
      const base = await deployFixture();
      const { trading, seller, publicClient } = base;

      let hash = await trading.write.mintResources([
        seller.account.address,
        0,
        1000n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await trading.write.createOffer([
        seller.account.address,
        0,
        500n,
        10n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      return { ...base, offerId: 0n };
    }

    it("should cancel an offer and return resources", async function () {
      const { trading, seller, publicClient, offerId } =
        await loadFixture(offerFixture);

      // Seller had 1000, put 500 in offer, so 500 remaining
      expect(
        await trading.read.agentResources([seller.account.address, 0])
      ).to.equal(500n);

      const hash = await trading.write.cancelOffer([offerId]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Resources returned
      expect(
        await trading.read.agentResources([seller.account.address, 0])
      ).to.equal(1000n);

      // Offer deactivated
      const offer = await trading.read.offers([offerId]);
      expect(offer[4]).to.equal(false);
    });

    it("should emit OfferCancelled event", async function () {
      const { trading, publicClient, offerId } =
        await loadFixture(offerFixture);

      const hash = await trading.write.cancelOffer([offerId]);
      await publicClient.waitForTransactionReceipt({ hash });

      const events = await trading.getEvents.OfferCancelled();
      expect(events).to.have.lengthOf(1);
      expect(events[0].args.offerId).to.equal(offerId);
    });

    it("should revert if offer already cancelled", async function () {
      const { trading, publicClient, offerId } =
        await loadFixture(offerFixture);

      const hash = await trading.write.cancelOffer([offerId]);
      await publicClient.waitForTransactionReceipt({ hash });

      await expect(trading.write.cancelOffer([offerId])).to.be.rejectedWith(
        "Not active"
      );
    });

    it("should revert if offer was fully traded (not active)", async function () {
      const { trading, buyer, publicClient, offerId } =
        await loadFixture(offerFixture);

      const hash = await trading.write.executeTrade([
        buyer.account.address,
        offerId,
        500n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      await expect(trading.write.cancelOffer([offerId])).to.be.rejectedWith(
        "Not active"
      );
    });

    it("should cancel a partially filled offer and return remaining", async function () {
      const { trading, seller, buyer, publicClient, offerId } =
        await loadFixture(offerFixture);

      // Partial trade
      let hash = await trading.write.executeTrade([
        buyer.account.address,
        offerId,
        200n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Cancel remaining
      hash = await trading.write.cancelOffer([offerId]);
      await publicClient.waitForTransactionReceipt({ hash });

      // Seller gets back remaining 300 (had 500 after offer creation + 300 returned)
      expect(
        await trading.read.agentResources([seller.account.address, 0])
      ).to.equal(800n); // 500 + 300

      const offer = await trading.read.offers([offerId]);
      expect(offer[4]).to.equal(false);
    });

    it("should revert if called by non-owner", async function () {
      const { trading, seller, offerId } = await loadFixture(offerFixture);

      const tradingAsSeller = await hre.viem.getContractAt(
        "AgentTrading",
        trading.address,
        { client: { wallet: seller } }
      );

      await expect(
        tradingAsSeller.write.cancelOffer([offerId])
      ).to.be.rejectedWith("OwnableUnauthorizedAccount");
    });

    it("should revert for non-existent offer ID", async function () {
      const { trading } = await loadFixture(offerFixture);

      await expect(trading.write.cancelOffer([999n])).to.be.rejectedWith(
        "Not active"
      );
    });
  });

  describe("burnResources", function () {
    it("should burn resources from an agent", async function () {
      const { trading, seller, publicClient } =
        await loadFixture(deployFixture);

      // Mint then burn
      let hash = await trading.write.mintResources([
        seller.account.address,
        3, // food
        100n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await trading.write.burnResources([
        seller.account.address,
        3,
        30n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      const balance = await trading.read.agentResources([
        seller.account.address,
        3,
      ]);
      expect(balance).to.equal(70n);
    });

    it("should emit ResourcesBurned event", async function () {
      const { trading, seller, publicClient } =
        await loadFixture(deployFixture);

      let hash = await trading.write.mintResources([
        seller.account.address,
        2, // energy
        50n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      hash = await trading.write.burnResources([
        seller.account.address,
        2,
        10n,
      ]);
      const receipt = await publicClient.waitForTransactionReceipt({ hash });
      expect(receipt.status).to.equal("success");
    });

    it("should revert when burning more than balance", async function () {
      const { trading, seller, publicClient } =
        await loadFixture(deployFixture);

      const hash = await trading.write.mintResources([
        seller.account.address,
        3,
        10n,
      ]);
      await publicClient.waitForTransactionReceipt({ hash });

      await expect(
        trading.write.burnResources([seller.account.address, 3, 50n])
      ).to.be.rejectedWith("Insufficient resources");
    });

    it("should revert when called by non-owner", async function () {
      const { trading, seller } = await loadFixture(deployFixture);

      const tradingAsSeller = await hre.viem.getContractAt(
        "AgentTrading",
        trading.address,
        { client: { wallet: seller } }
      );

      await expect(
        tradingAsSeller.write.burnResources([seller.account.address, 3, 10n])
      ).to.be.rejectedWith("OwnableUnauthorizedAccount");
    });
  });
});
