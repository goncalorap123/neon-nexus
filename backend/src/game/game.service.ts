import { Injectable } from '@nestjs/common';
import { AgentService } from '../agent/agent.service';
import { RandomService } from '../random/random.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { TransactionLogService } from '../database/transaction-log.service';

const RESOURCE_NAMES = ['wood', 'steel', 'energy', 'food'];
const BURN_RATES: Record<number, { food: number; energy: number }> = {
  0: { food: 25, energy: 20 },
  1: { food: 35, energy: 28 },
  2: { food: 55, energy: 45 },
};

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

    // Survival info
    const dbAgent = await this.agentService.getAgentEntity(playerId);
    const strategyType = Number(agent.onChain?.strategyType ?? 1);
    const burnRate = BURN_RATES[strategyType] ?? BURN_RATES[1];
    const aliveCount = await this.agentService.getAliveCount();

    // Format on-chain values for display (6 decimal token)
    if (agent.onChain) {
      agent.onChain.deposit = +(Number(agent.onChain.deposit) / 1_000_000).toFixed(2);
      agent.onChain.yieldEarned = +(Number(agent.onChain.yieldEarned) / 1_000_000).toFixed(2);
    }

    return {
      player: agent,
      resources,
      flowBalance,
      score,
      survival: {
        foodBurnRate: burnRate.food,
        energyBurnRate: burnRate.energy,
        cyclesOfFoodLeft: burnRate.food > 0 ? Math.floor(food / burnRate.food) : 999,
        cyclesOfEnergyLeft: burnRate.energy > 0 ? Math.floor(energy / burnRate.energy) : 999,
        cyclesSurvived: dbAgent?.cyclesSurvived ?? 0,
        eliminated: dbAgent?.eliminated ?? false,
        isHouseAgent: dbAgent?.isHouseAgent ?? false,
      },
      aliveCount,
      totalAgents: await this.agentService.getAllAgentsIncludingEliminated().then((a) => a.length),
    };
  }

  async triggerRandomEvent(playerId: string, eventType: number): Promise<{ txHash: string }> {
    const walletInfo = await this.agentService.getWalletInfo(playerId);
    if (!walletInfo) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    // Commit on-chain via Cadence Arch VRF
    const commitData = this.blockchainService.encodeCommitEvent(walletInfo.address, eventType);
    const tx = await this.blockchainService.ownerSendTransaction(
      this.blockchainService.getRandomEventsAddress(),
      commitData,
    );
    return { txHash: tx.hash };
  }

  // Track cooldowns: playerId -> last event timestamp
  private eventCooldowns: Map<string, number> = new Map();
  private readonly EVENT_COOLDOWN_MS = 10 * 60 * 1000; // 10 minutes = 2 cycles

  async revealRandomEvent(playerId: string, eventType: number): Promise<{ txHash: string; outcome: any }> {
    const walletInfo = await this.agentService.getWalletInfo(playerId);
    if (!walletInfo) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    const agentTrading = this.blockchainService.getAgentTradingAddress();

    // Reveal on-chain — Cadence Arch VRF generates the random outcome
    const revealData = this.blockchainService.encodeRevealEvent(walletInfo.address);
    const revealResult = await this.blockchainService.ownerSendTransaction(
      this.blockchainService.getRandomEventsAddress(),
      revealData,
    );

    // Parse the VRF outcome from the EventRevealed log
    const roll = await this.blockchainService.parseRevealOutcome(revealResult.hash);
    let outcome: any = { roll, eventType, vrfTxHash: revealResult.hash, effects: [] };

    try {
      if (eventType === 0) {
        // === GACHA ROLL ===
        // Cost: 10 food (burned on-chain)
        const foodBalance = await this.blockchainService.getAgentResources(walletInfo.address, 3);
        if (foodBalance < 10n) {
          return { txHash: '', outcome: { error: 'Not enough food (need 10)', effects: [{ type: 'insufficient_food' }] } };
        }

        // Burn the cost
        const burnData = this.blockchainService.encodeBurnResources(walletInfo.address, 3, 10n);
        await this.blockchainService.ownerSendTransaction(agentTrading, burnData);
        outcome.cost = { resource: 'food', amount: 10 };

        if (roll < 20) {
          // Legendary (20%): +30 food AND +30 energy
          await this.blockchainService.ownerSendTransaction(agentTrading,
            this.blockchainService.encodeMintResources(walletInfo.address, 3, 30n));
          await this.blockchainService.ownerSendTransaction(agentTrading,
            this.blockchainService.encodeMintResources(walletInfo.address, 2, 30n));
          outcome.effects.push({ type: 'legendary', description: '+30 Food, +30 Energy', rarity: 'legendary' });
        } else if (roll < 50) {
          // Rare (30%): +15 food or energy (whichever is lower)
          const energy = await this.blockchainService.getAgentResources(walletInfo.address, 2);
          const resType = (foodBalance <= energy) ? 3 : 2;
          await this.blockchainService.ownerSendTransaction(agentTrading,
            this.blockchainService.encodeMintResources(walletInfo.address, resType, 15n));
          outcome.effects.push({ type: 'rare', description: `+15 ${RESOURCE_NAMES[resType]}`, rarity: 'rare' });
        } else if (roll < 80) {
          // Common (30%): +8 food or energy
          const energy = await this.blockchainService.getAgentResources(walletInfo.address, 2);
          const resType = (foodBalance <= energy) ? 3 : 2;
          await this.blockchainService.ownerSendTransaction(agentTrading,
            this.blockchainService.encodeMintResources(walletInfo.address, resType, 8n));
          outcome.effects.push({ type: 'common', description: `+8 ${RESOURCE_NAMES[resType]}`, rarity: 'common' });
        } else {
          // Nothing (20%): wasted 10 food
          outcome.effects.push({ type: 'nothing', description: 'Nothing! 10 food wasted.', rarity: 'common' });
        }

      } else {
        // === RANDOM EVENT (market volatility) ===
        // Cooldown: once per 2 cycles (10 minutes)
        const now = Date.now();
        const lastUsed = this.eventCooldowns.get(playerId) ?? 0;
        if (now - lastUsed < this.EVENT_COOLDOWN_MS) {
          const secsLeft = Math.ceil((this.EVENT_COOLDOWN_MS - (now - lastUsed)) / 1000);
          const minsLeft = Math.ceil(secsLeft / 60);
          return { txHash: '', outcome: { error: `On cooldown (${minsLeft}m left)`, effects: [{ type: 'cooldown' }] } };
        }
        this.eventCooldowns.set(playerId, now);

        if (roll < 33) {
          // Bull market (33%): +20 random resource
          const resType = Math.floor(Math.random() * 4);
          await this.blockchainService.ownerSendTransaction(agentTrading,
            this.blockchainService.encodeMintResources(walletInfo.address, resType, 20n));
          outcome.effects.push({ type: 'bull_market', description: `Bull market! +20 ${RESOURCE_NAMES[resType]}`, rarity: 'rare' });
        } else if (roll < 66) {
          // Flat market (33%): nothing happens
          outcome.effects.push({ type: 'flat_market', description: 'Flat market. Nothing happened.', rarity: 'common' });
        } else {
          // Bear market (33%): -20 from random resource (food or energy)
          const resType = Math.random() < 0.5 ? 3 : 2; // food or energy only
          const balance = await this.blockchainService.getAgentResources(walletInfo.address, resType);
          const burnAmount = balance < 20n ? balance : 20n;
          if (burnAmount > 0n) {
            await this.blockchainService.ownerSendTransaction(agentTrading,
              this.blockchainService.encodeBurnResources(walletInfo.address, resType, burnAmount));
          }
          outcome.effects.push({ type: 'bear_market', description: `Bear market! -${burnAmount} ${RESOURCE_NAMES[resType]}`, rarity: 'legendary' });
        }
      }
    } catch (error) {
      outcome.error = error.message;
    }

    await this.txLogService.log(playerId, walletInfo.address, 'event_revealed', '', outcome);
    return { txHash: '', outcome };
  }

  async getLeaderboard(): Promise<any[]> {
    const allAgents = await this.agentService.getAllAgentsIncludingEliminated();

    const agentsWithScores = await Promise.all(
      allAgents.map(async (dbAgent) => {
        let score = 0;
        let onChain: any = null;
        try {
          onChain = await this.blockchainService.getAgent(dbAgent.address);
          const deposit = Number(onChain?.deposit ?? 0);
          const yieldEarned = Number(onChain?.yieldEarned ?? 0);

          let wood = 0, steel = 0, energy = 0, food = 0;
          try {
            wood = Number(await this.blockchainService.getAgentResources(dbAgent.address, 0));
            steel = Number(await this.blockchainService.getAgentResources(dbAgent.address, 1));
            energy = Number(await this.blockchainService.getAgentResources(dbAgent.address, 2));
            food = Number(await this.blockchainService.getAgentResources(dbAgent.address, 3));
          } catch {}

          score = deposit + yieldEarned + (wood * 10 + steel * 15 + energy * 20 + food * 10) + (dbAgent.cyclesSurvived * 100);
        } catch {}
        return {
          playerId: dbAgent.playerId,
          address: dbAgent.address,
          score,
          alive: dbAgent.active && !dbAgent.eliminated,
          eliminated: dbAgent.eliminated,
          isHouseAgent: dbAgent.isHouseAgent,
          cyclesSurvived: dbAgent.cyclesSurvived,
        };
      }),
    );

    // Sort alive-first, then by score descending
    return agentsWithScores.sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return b.score - a.score;
    });
  }

  async getRoundStatus(): Promise<any> {
    const allAgents = await this.agentService.getAllAgentsIncludingEliminated();
    const aliveCount = allAgents.filter((a) => a.active && !a.eliminated).length;

    // Build detailed agent list with on-chain data
    let yieldPool = 0;
    const agentsDetail = await Promise.all(
      allAgents.map(async (dbAgent) => {
        let deposit = 0, yieldEarned = 0, strategyType = 1;
        let wood = 0, steel = 0, energy = 0, food = 0;
        try {
          const onChain = await this.blockchainService.getAgent(dbAgent.address);
          deposit = Number(onChain?.deposit ?? 0);
          yieldEarned = Number(onChain?.yieldEarned ?? 0);
          strategyType = Number(onChain?.strategyType ?? 1);
          yieldPool += yieldEarned;
        } catch {}
        try {
          wood = Number(await this.blockchainService.getAgentResources(dbAgent.address, 0));
          steel = Number(await this.blockchainService.getAgentResources(dbAgent.address, 1));
          energy = Number(await this.blockchainService.getAgentResources(dbAgent.address, 2));
          food = Number(await this.blockchainService.getAgentResources(dbAgent.address, 3));
        } catch {}

        const burnRate = BURN_RATES[strategyType] ?? BURN_RATES[1];
        const alive = dbAgent.active && !dbAgent.eliminated;

        return {
          playerId: dbAgent.playerId,
          address: dbAgent.address,
          isHouseAgent: dbAgent.isHouseAgent,
          alive,
          eliminated: dbAgent.eliminated,
          deposit: +(deposit / 1_000_000).toFixed(2),
          yieldEarned: +(yieldEarned / 1_000_000).toFixed(2),
          strategyType,
          resources: { wood, steel, energy, food },
          burnRate: { food: burnRate.food, energy: burnRate.energy },
          cyclesSurvived: dbAgent.cyclesSurvived,
        };
      }),
    );

    // Sort alive-first, then by yield descending
    agentsDetail.sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return b.yieldEarned - a.yieldEarned;
    });

    // Cycle timing: cycles run every 5 minutes
    const now = Math.floor(Date.now() / 1000);
    const cycleInterval = 300; // 5 minutes in seconds
    const secondsUntilNextCycle = cycleInterval - (now % cycleInterval);

    return {
      aliveCount,
      totalAgents: allAgents.length,
      yieldPool: +(yieldPool / 1_000_000).toFixed(2),
      secondsUntilNextCycle,
      agents: agentsDetail,
    };
  }
}
