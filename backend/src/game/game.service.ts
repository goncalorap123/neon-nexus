import { Injectable } from '@nestjs/common';
import { AgentService } from '../agent/agent.service';
import { RandomService } from '../random/random.service';
import { BlockchainService } from '../blockchain/blockchain.service';

@Injectable()
export class GameService {
  // In-memory store for pending random event secrets
  private pendingSecrets = new Map<string, bigint>();

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
      hasPendingEvent: this.pendingSecrets.has(playerId),
    };
  }

  async triggerRandomEvent(playerId: string): Promise<{ txHash: string; commitment: string }> {
    const walletInfo = this.agentService.getWalletInfo(playerId);
    if (!walletInfo) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    const secret = BigInt(Math.floor(Math.random() * Number.MAX_SAFE_INTEGER));
    this.pendingSecrets.set(playerId, secret);

    const result = await this.randomService.commitEvent(walletInfo.walletId, secret);
    return result;
  }

  async revealRandomEvent(playerId: string): Promise<{ txHash: string }> {
    const walletInfo = this.agentService.getWalletInfo(playerId);
    if (!walletInfo) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    const secret = this.pendingSecrets.get(playerId);
    if (!secret) {
      throw new Error(`No pending event for player ${playerId}`);
    }

    const result = await this.randomService.revealEvent(walletInfo.walletId, secret);
    this.pendingSecrets.delete(playerId);
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
        const balA = a.onChain?.balance ?? 0n;
        const balB = b.onChain?.balance ?? 0n;
        if (balB > balA) return 1;
        if (balB < balA) return -1;
        return 0;
      });
  }
}
