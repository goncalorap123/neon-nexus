import { Injectable } from '@nestjs/common';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class RandomService {
  constructor(
    private readonly blockchainService: BlockchainService,
  ) {}

  async commitEvent(walletId: string, agentAddress: string, eventType: number): Promise<{ txHash: string }> {
    const data = this.blockchainService.encodeCommitEvent(agentAddress, eventType);
    const tx = await this.blockchainService.ownerSendTransaction(
      this.blockchainService.getRandomEventsAddress(),
      data,
    );
    return { txHash: tx.hash };
  }

  async revealEvent(walletId: string, agentAddress: string): Promise<{ txHash: string }> {
    const data = this.blockchainService.encodeRevealEvent(agentAddress);
    const tx = await this.blockchainService.ownerSendTransaction(
      this.blockchainService.getRandomEventsAddress(),
      data,
    );
    return { txHash: tx.hash };
  }
}
