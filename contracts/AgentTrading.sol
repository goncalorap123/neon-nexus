// SPDX-License-Identifier: MIT
pragma solidity 0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";

contract AgentTrading is Ownable {
    struct TradeOffer {
        address seller;
        uint8 resourceType; // 0=wood, 1=steel, 2=energy, 3=food
        uint256 quantity;
        uint256 pricePerUnit;
        bool active;
    }

    uint256 public nextOfferId;
    mapping(uint256 => TradeOffer) public offers;
    mapping(address => mapping(uint8 => uint256)) public agentResources;

    event OfferCreated(uint256 indexed offerId, address indexed seller, uint8 resourceType, uint256 quantity, uint256 price);
    event TradeExecuted(uint256 indexed offerId, address indexed buyer, uint256 quantity);
    event OfferCancelled(uint256 indexed offerId);

    constructor() Ownable(msg.sender) {}

    function createOffer(address seller, uint8 resourceType, uint256 quantity, uint256 pricePerUnit) external onlyOwner returns (uint256) {
        require(agentResources[seller][resourceType] >= quantity, "Insufficient resources");
        uint256 offerId = nextOfferId++;
        offers[offerId] = TradeOffer(seller, resourceType, quantity, pricePerUnit, true);
        agentResources[seller][resourceType] -= quantity;
        emit OfferCreated(offerId, seller, resourceType, quantity, pricePerUnit);
        return offerId;
    }

    function executeTrade(address buyer, uint256 offerId, uint256 quantity) external onlyOwner {
        TradeOffer storage offer = offers[offerId];
        require(offer.active, "Offer not active");
        require(offer.quantity >= quantity, "Insufficient quantity");
        offer.quantity -= quantity;
        if (offer.quantity == 0) offer.active = false;
        agentResources[buyer][offer.resourceType] += quantity;
        emit TradeExecuted(offerId, buyer, quantity);
    }

    function mintResources(address agent, uint8 resourceType, uint256 quantity) external onlyOwner {
        agentResources[agent][resourceType] += quantity;
    }

    function cancelOffer(uint256 offerId) external onlyOwner {
        TradeOffer storage offer = offers[offerId];
        require(offer.active, "Not active");
        agentResources[offer.seller][offer.resourceType] += offer.quantity;
        offer.active = false;
        emit OfferCancelled(offerId);
    }
}
