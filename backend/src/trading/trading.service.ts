import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TradeOfferEntity } from '../database/entities/trade-offer.entity';
import { AgentService } from '../agent/agent.service';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class TradingService {
  private readonly logger = new Logger(TradingService.name);

  constructor(
    @InjectRepository(TradeOfferEntity)
    private readonly offerRepo: Repository<TradeOfferEntity>,
    private readonly agentService: AgentService,
    private readonly blockchainService: BlockchainService,
  ) {}

  async getActiveOffers(): Promise<TradeOfferEntity[]> {
    return this.offerRepo.find({ where: { active: true }, order: { createdAt: 'DESC' } });
  }

  async createOffer(
    playerId: string,
    resourceType: number,
    quantity: string,
    pricePerUnit: string,
  ): Promise<{ offerId: number; txHash: string }> {
    const walletInfo = await this.agentService.getWalletInfo(playerId);
    if (!walletInfo) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    // createOffer is onlyOwner
    const data = this.blockchainService.encodeCreateOffer(
      walletInfo.address,
      resourceType,
      BigInt(quantity),
      BigInt(pricePerUnit),
    );
    const tx = await this.blockchainService.ownerSendTransaction(
      this.blockchainService.getAgentTradingAddress(),
      data,
    );

    const nextId = Number(await this.blockchainService.getNextOfferId()) - 1;

    const offer = this.offerRepo.create({
      onChainOfferId: nextId,
      sellerPlayerId: playerId,
      sellerAddress: walletInfo.address,
      resourceType,
      quantity,
      pricePerUnit,
      txHash: tx.hash,
    });
    await this.offerRepo.save(offer);

    this.logger.log(`Offer created: ${playerId} selling ${quantity} of resource ${resourceType}`);
    return { offerId: offer.id, txHash: tx.hash };
  }

  async executeTrade(
    buyerPlayerId: string,
    offerId: number,
    quantity: string,
  ): Promise<{ txHash: string }> {
    const walletInfo = await this.agentService.getWalletInfo(buyerPlayerId);
    if (!walletInfo) {
      throw new Error(`No wallet found for player ${buyerPlayerId}`);
    }

    const offer = await this.offerRepo.findOneBy({ id: offerId, active: true });
    if (!offer) {
      throw new Error(`Offer ${offerId} not found or inactive`);
    }

    // executeTrade is onlyOwner
    const data = this.blockchainService.encodeExecuteTrade(
      walletInfo.address,
      BigInt(offer.onChainOfferId),
      BigInt(quantity),
    );
    const tx = await this.blockchainService.ownerSendTransaction(
      this.blockchainService.getAgentTradingAddress(),
      data,
    );

    const remainingQty = BigInt(offer.quantity) - BigInt(quantity);
    if (remainingQty <= 0n) {
      offer.active = false;
    }
    offer.quantity = remainingQty.toString();
    await this.offerRepo.save(offer);

    this.logger.log(`Trade executed: ${buyerPlayerId} bought ${quantity} from offer ${offerId}`);
    return { txHash: tx.hash };
  }
}
