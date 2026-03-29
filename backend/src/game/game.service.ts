import { Injectable } from '@nestjs/common';
import { AgentService } from '../agent/agent.service';
import { RandomService } from '../random/random.service';
import { BlockchainService } from '../blockchain/blockchain.service';

const RESOURCE_NAMES = ['wood', 'steel', 'energy', 'food'];

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

    const resources: Record<string, string> = {};
    for (let i = 0; i < 4; i++) {
      try {
        const balance = await this.blockchainService.getAgentResources(agent.address, i);
        resources[RESOURCE_NAMES[i]] = balance.toString();
      } catch {
        resources[RESOURCE_NAMES[i]] = '0';
      }
    }

    return {
      player: agent,
      resources,
    };
  }

  async triggerRandomEvent(playerId: string, eventType: number): Promise<{ txHash: string }> {
    const walletInfo = await this.agentService.getWalletInfo(playerId);
    if (!walletInfo) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    return this.randomService.commitEvent(
      walletInfo.address,
      walletInfo.address,
      eventType,
    );
  }

  async revealRandomEvent(playerId: string): Promise<{ txHash: string }> {
    const walletInfo = await this.agentService.getWalletInfo(playerId);
    if (!walletInfo) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    return this.randomService.revealEvent(
      walletInfo.address,
      walletInfo.address,
    );
  }

  async getLeaderboard(): Promise<any[]> {
    const playerIds = await this.agentService.getAllPlayerIds();
    const agents = await Promise.all(
      playerIds.map((id) => this.agentService.getAgent(id)),
    );

    return agents
      .filter((a) => a !== null)
      .sort((a, b) => {
        const depA = BigInt(a.onChain?.deposit ?? 0);
        const depB = BigInt(b.onChain?.deposit ?? 0);
        if (depB > depA) return 1;
        if (depB < depA) return -1;
        return 0;
      });
  }
}
