import { Injectable } from '@nestjs/common';
import { AgentService } from '../agent/agent.service';
import { RandomService } from '../random/random.service';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class GameService {
  constructor(
    private readonly agentService: AgentService,
    private readonly randomService: RandomService,
    private readonly blockchainService: BlockchainService,
  ) {}

  async getGameState(playerId: string): Promise<any> {
    const agent = await this.agentService.getAgent(playerId);
    if (!agent) {
      return null;
    }

    return {
      player: agent,
    };
  }

  async triggerRandomEvent(playerId: string, eventType: number): Promise<{ txHash: string }> {
    const walletInfo = this.agentService.getWalletInfo(playerId);
    if (!walletInfo) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    // Commit phase: requests randomness on-chain via CadenceRandomConsumer
    const result = await this.randomService.commitEvent(
      walletInfo.address,
      walletInfo.address,
      eventType,
    );
    return result;
  }

  async revealRandomEvent(playerId: string): Promise<{ txHash: string }> {
    const walletInfo = this.agentService.getWalletInfo(playerId);
    if (!walletInfo) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    // Reveal phase: must be called in a later block than commit
    const result = await this.randomService.revealEvent(
      walletInfo.address,
      walletInfo.address,
    );
    return result;
  }

  async getLeaderboard(): Promise<any[]> {
    const playerIds = this.agentService.getAllPlayerIds();
    const agents = await Promise.all(
      playerIds.map(async (id) => {
        const agent = await this.agentService.getAgent(id);
        return agent;
      }),
    );

    return agents
      .filter((a) => a !== null)
      .sort((a, b) => {
        const depA = a.onChain?.deposit ?? 0n;
        const depB = b.onChain?.deposit ?? 0n;
        if (depB > depA) return 1;
        if (depB < depA) return -1;
        return 0;
      });
  }
}
