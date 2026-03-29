import { Injectable } from '@nestjs/common';
import { AgentService } from '../agent/agent.service';
import { RandomService } from '../random/random.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { TransactionLogService } from '../database/transaction-log.service';

const RESOURCE_NAMES = ['wood', 'steel', 'energy', 'food'];

@Injectable()
export class GameService {
  constructor(
    private readonly agentService: AgentService,
    private readonly randomService: RandomService,
    private readonly blockchainService: BlockchainService,
    private readonly txLogService: TransactionLogService,
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

    // Get FLOW balance
    let flowBalance = '0';
    try {
      flowBalance = await this.blockchainService.getBalance(agent.address);
    } catch {
      flowBalance = '0';
    }

    // Calculate score
    const deposit = Number(agent.onChain?.deposit ?? 0);
    const yieldEarned = Number(agent.onChain?.yieldEarned ?? 0);
    const wood = Number(resources['wood'] ?? 0);
    const steel = Number(resources['steel'] ?? 0);
    const energy = Number(resources['energy'] ?? 0);
    const food = Number(resources['food'] ?? 0);
    const score = deposit + yieldEarned + (wood * 10 + steel * 15 + energy * 20 + food * 10);

    return {
      player: agent,
      resources,
      flowBalance,
      score,
    };
  }

  async triggerRandomEvent(playerId: string, eventType: number): Promise<{ txHash: string }> {
    const walletInfo = await this.agentService.getWalletInfo(playerId);
    if (!walletInfo) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    return this.randomService.commitEvent(
      walletInfo.walletId,
      walletInfo.address,
      eventType,
    );
  }

  async revealRandomEvent(playerId: string, eventType: number): Promise<{ txHash: string; outcome: any }> {
    const walletInfo = await this.agentService.getWalletInfo(playerId);
    if (!walletInfo) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    const revealResult = await this.randomService.revealEvent(
      walletInfo.walletId,
      walletInfo.address,
    );

    // Simulate outcome in backend (MVP: use Math.random matching contract ranges)
    const roll = Math.floor(Math.random() * 100);
    let outcome: any = { roll, eventType, effects: [] };

    try {
      if (eventType === 0) {
        // Gacha
        if (roll < 20) {
          // Legendary: mint 500 of random resource
          const resType = Math.floor(Math.random() * 4);
          const mintData = this.blockchainService.encodeMintResources(walletInfo.address, resType, 500n);
          await this.blockchainService.ownerSendTransaction(this.blockchainService.getAgentTradingAddress(), mintData);
          outcome.effects.push({ type: 'legendary', resource: RESOURCE_NAMES[resType], amount: 500 });
        } else if (roll < 50) {
          // Rare: mint 200 of random resource
          const resType = Math.floor(Math.random() * 4);
          const mintData = this.blockchainService.encodeMintResources(walletInfo.address, resType, 200n);
          await this.blockchainService.ownerSendTransaction(this.blockchainService.getAgentTradingAddress(), mintData);
          outcome.effects.push({ type: 'rare', resource: RESOURCE_NAMES[resType], amount: 200 });
        } else if (roll < 80) {
          // Common: mint 50 of random resource
          const resType = Math.floor(Math.random() * 4);
          const mintData = this.blockchainService.encodeMintResources(walletInfo.address, resType, 50n);
          await this.blockchainService.ownerSendTransaction(this.blockchainService.getAgentTradingAddress(), mintData);
          outcome.effects.push({ type: 'common', resource: RESOURCE_NAMES[resType], amount: 50 });
        } else {
          outcome.effects.push({ type: 'nothing' });
        }
      } else if (eventType === 1) {
        // Disaster: no resource loss for now, just log
        outcome.effects.push({ type: 'disaster', message: 'Disaster struck but no losses (MVP)' });
      } else if (eventType === 2) {
        // Trade bonus: mint bonus resources = outcome * 10
        const bonusAmount = BigInt(roll * 10);
        if (bonusAmount > 0n) {
          const resType = Math.floor(Math.random() * 4);
          const mintData = this.blockchainService.encodeMintResources(walletInfo.address, resType, bonusAmount);
          await this.blockchainService.ownerSendTransaction(this.blockchainService.getAgentTradingAddress(), mintData);
          outcome.effects.push({ type: 'trade_bonus', resource: RESOURCE_NAMES[resType], amount: Number(bonusAmount) });
        }
      } else if (eventType === 3) {
        // Loot: mint outcome / 10 of each resource
        const lootAmount = BigInt(Math.floor(roll / 10));
        if (lootAmount > 0n) {
          for (let i = 0; i < 4; i++) {
            const mintData = this.blockchainService.encodeMintResources(walletInfo.address, i, lootAmount);
            await this.blockchainService.ownerSendTransaction(this.blockchainService.getAgentTradingAddress(), mintData);
          }
          outcome.effects.push({ type: 'loot', amountEach: Number(lootAmount), resources: RESOURCE_NAMES });
        }
      }
    } catch (error) {
      outcome.error = error.message;
    }

    // Log the event outcome
    await this.txLogService.log(playerId, walletInfo.address, 'event_revealed', revealResult.txHash, outcome);

    return { txHash: revealResult.txHash, outcome };
  }

  async getLeaderboard(): Promise<any[]> {
    const playerIds = await this.agentService.getAllPlayerIds();
    const agents = await Promise.all(
      playerIds.map((id) => this.agentService.getAgent(id)),
    );

    // Fetch resources and compute scores for all agents
    const agentsWithScores = await Promise.all(
      agents.filter((a) => a !== null).map(async (a) => {
        let score = 0;
        try {
          const deposit = Number(a.onChain?.deposit ?? 0);
          const yieldEarned = Number(a.onChain?.yieldEarned ?? 0);

          let wood = 0, steel = 0, energy = 0, food = 0;
          try {
            wood = Number(await this.blockchainService.getAgentResources(a.address, 0));
            steel = Number(await this.blockchainService.getAgentResources(a.address, 1));
            energy = Number(await this.blockchainService.getAgentResources(a.address, 2));
            food = Number(await this.blockchainService.getAgentResources(a.address, 3));
          } catch {}

          score = deposit + yieldEarned + (wood * 10 + steel * 15 + energy * 20 + food * 10);
        } catch {}
        return { ...a, score };
      }),
    );

    return agentsWithScores.sort((a, b) => b.score - a.score);
  }
}
