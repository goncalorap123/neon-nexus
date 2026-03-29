import { Injectable } from '@nestjs/common';
import { PrivyService } from '../privy/privy.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { getEnvConfig } from '../config/env.config';

@Injectable()
export class RandomService {
  constructor(
    private readonly privyService: PrivyService,
    private readonly blockchainService: BlockchainService,
  ) {}

  async commitEvent(walletAddress: string, agentAddress: string, eventType: number): Promise<{ txHash: string }> {
    const config = getEnvConfig();
    const data = this.blockchainService.encodeCommitEvent(agentAddress, eventType);
    const tx = await this.privyService.sendTransaction(
      walletAddress,
      this.blockchainService.getRandomEventsAddress(),
      data,
      config.FLOW_CHAIN_ID,
    );

    return { txHash: tx.hash };
  }

  async revealEvent(walletAddress: string, agentAddress: string): Promise<{ txHash: string }> {
    const config = getEnvConfig();
    const data = this.blockchainService.encodeRevealEvent(agentAddress);
    const tx = await this.privyService.sendTransaction(
      walletAddress,
      this.blockchainService.getRandomEventsAddress(),
      data,
      config.FLOW_CHAIN_ID,
    );

    return { txHash: tx.hash };
  }
}
