import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgentService } from '../agent/agent.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { TransactionLogService } from '../database/transaction-log.service';
import { AiReasoningService, AgentDecisionContext } from '../ai/ai-reasoning.service';
import { AgentActionService } from '../database/agent-action.service';

// Yield rates per hour based on strategy (in token base units, e.g. 6 decimals)
const YIELD_RATES = [
  50n,   // conservative
  100n,  // balanced
  200n,  // aggressive
];

// Resource distribution weights per strategy [wood, steel, energy, food]
const RESOURCE_WEIGHTS: Record<number, number[]> = {
  0: [30, 30, 20, 20],
  1: [25, 35, 25, 15],
  2: [15, 20, 45, 20],
};

// Burn rates per cycle based on strategy [food, energy]
const BURN_RATES: Record<number, { food: bigint; energy: bigint }> = {
  0: { food: 2n, energy: 1n },   // conservative
  1: { food: 3n, energy: 2n },   // balanced
  2: { food: 5n, energy: 4n },   // aggressive
};

const RESOURCE_NAMES = ['wood', 'steel', 'energy', 'food'];
const STRATEGY_NAMES = ['Conservative', 'Balanced', 'Aggressive'];

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly blockchainService: BlockchainService,
    private readonly txLogService: TransactionLogService,
    private readonly aiReasoningService: AiReasoningService,
    private readonly agentActionService: AgentActionService,
  ) {}

  // Burn operational costs and check survival before each decision cycle
  async burnAndCheckSurvival(): Promise<void> {
    this.logger.log('Running burn & survival check...');

    const agents = await this.agentService.getAliveAgents();
    if (agents.length === 0) return;

    for (const agent of agents) {
      try {
        const onChain = await this.blockchainService.getAgent(agent.address);
        if (!onChain || !onChain.active) continue;

        const strategyType = Number(onChain.strategyType);
        const burnRate = BURN_RATES[strategyType] ?? BURN_RATES[1];

        // Read food (type 3) and energy (type 2) balances
        const foodBalance = await this.blockchainService.getAgentResources(agent.address, 3);
        const energyBalance = await this.blockchainService.getAgentResources(agent.address, 2);

        // Check if agent can pay operational costs
        if (foodBalance < burnRate.food || energyBalance < burnRate.energy) {
          // LIQUIDATION — agent can't pay costs
          this.logger.warn(`Agent ${agent.playerId} LIQUIDATED — food: ${foodBalance}, energy: ${energyBalance}`);

          // Deactivate on-chain
          const deactivateData = this.blockchainService.encodeDeactivateAgent(agent.address);
          await this.blockchainService.ownerSendTransaction(
            this.blockchainService.getNeonNexusAddress(),
            deactivateData,
          );

          // Eliminate in DB
          await this.agentService.eliminateAgent(agent.playerId);

          // Redistribute yield to survivors
          const yieldEarned = BigInt(onChain.yieldEarned);
          if (yieldEarned > 0n) {
            const survivors = await this.agentService.getAliveAgents();
            if (survivors.length > 0) {
              const sharePerSurvivor = yieldEarned / BigInt(survivors.length);
              if (sharePerSurvivor > 0n) {
                for (const survivor of survivors) {
                  const transferData = this.blockchainService.encodeTransferYield(
                    agent.address,
                    survivor.address,
                    sharePerSurvivor,
                  );
                  await this.blockchainService.ownerSendTransaction(
                    this.blockchainService.getNeonNexusAddress(),
                    transferData,
                  );
                }
              }
            }
          }

          await this.txLogService.log(agent.playerId, agent.address, 'agent_eliminated', '', {
            reason: 'insufficient_resources',
            foodBalance: foodBalance.toString(),
            energyBalance: energyBalance.toString(),
            yieldRedistributed: onChain.yieldEarned,
          });

          continue;
        }

        // Burn food and energy
        const burnFoodData = this.blockchainService.encodeBurnResources(agent.address, 3, burnRate.food);
        await this.blockchainService.ownerSendTransaction(
          this.blockchainService.getAgentTradingAddress(),
          burnFoodData,
        );

        const burnEnergyData = this.blockchainService.encodeBurnResources(agent.address, 2, burnRate.energy);
        await this.blockchainService.ownerSendTransaction(
          this.blockchainService.getAgentTradingAddress(),
          burnEnergyData,
        );

        // Increment cycles survived
        await this.agentService.incrementCyclesSurvived(agent.playerId);

        await this.txLogService.log(agent.playerId, agent.address, 'resources_burned', '', {
          foodBurned: burnRate.food.toString(),
          energyBurned: burnRate.energy.toString(),
          strategy: STRATEGY_NAMES[strategyType],
        });

      } catch (error) {
        this.logger.error(`Burn check failed for ${agent.playerId}: ${error.message}`);
      }
    }

    this.logger.log('Burn & survival check complete');
  }

  @Cron(CronExpression.EVERY_HOUR)
  async distributeYield() {
    this.logger.log('Running yield distribution...');

    const agents = await this.agentService.getAliveAgents();
    if (agents.length === 0) {
      this.logger.log('No alive agents, skipping yield distribution');
      return;
    }

    for (const agent of agents) {
      try {
        const onChain = await this.blockchainService.getAgent(agent.address);
        if (!onChain || !onChain.active) continue;

        const deposit = BigInt(onChain.deposit);
        if (deposit === 0n) continue;

        const strategyType = Number(onChain.strategyType);
        const yieldRate = YIELD_RATES[strategyType] ?? YIELD_RATES[1];
        const yieldAmount = (deposit * yieldRate) / 1_000_000n;
        if (yieldAmount === 0n) continue;

        // distributeYield is onlyOwner
        const yieldData = this.blockchainService.encodeDistributeYield(agent.address, yieldAmount);
        await this.blockchainService.ownerSendTransaction(
          this.blockchainService.getNeonNexusAddress(),
          yieldData,
        );

        await this.txLogService.log(agent.playerId, agent.address, 'yield_distributed', '', {
          yieldAmount: yieldAmount.toString(),
          strategyType,
        });

        this.logger.log(`Distributed ${yieldAmount} yield to agent ${agent.playerId}`);
      } catch (error) {
        this.logger.error(`Failed to distribute yield to ${agent.playerId}: ${error.message}`);
      }
    }

    this.logger.log('Yield distribution complete');
  }

  @Cron('*/5 * * * *')
  async runAgentDecisions() {
    this.logger.log('Running agent decision cycle...');

    // Burn operational costs and check survival first
    await this.burnAndCheckSurvival();

    const agents = await this.agentService.getAliveAgents();
    if (agents.length === 0) {
      this.logger.log('No alive agents, skipping decision cycle');
      return;
    }

    // Build leaderboard for context
    const agentScores: Array<{ playerId: string; address: string; score: number }> = [];
    for (const agent of agents) {
      try {
        const onChain = await this.blockchainService.getAgent(agent.address);
        if (!onChain || !onChain.active) continue;

        const deposit = Number(onChain.deposit);
        const yieldEarned = Number(onChain.yieldEarned);
        const resources: number[] = [];
        for (let i = 0; i < 4; i++) {
          const bal = await this.blockchainService.getAgentResources(agent.address, i);
          resources.push(Number(bal));
        }
        const score = deposit + yieldEarned + (resources[0] * 10 + resources[1] * 15 + resources[2] * 20 + resources[3] * 10);
        agentScores.push({ playerId: agent.playerId, address: agent.address, score });
      } catch {
        // skip agent for leaderboard
      }
    }
    agentScores.sort((a, b) => b.score - a.score);

    // Fetch active trade offers
    const activeOffers: AgentDecisionContext['activeTradeOffers'] = [];
    try {
      const nextOfferId = await this.blockchainService.getNextOfferId();
      for (let id = 0; id < Number(nextOfferId); id++) {
        try {
          const offer = await this.blockchainService.getOffer(id);
          const quantity = BigInt(offer.quantity ?? offer[2] ?? 0);
          if (quantity > 0n) {
            const resourceType = Number(offer.resourceType ?? offer[1] ?? 0);
            activeOffers.push({
              resourceType,
              resourceName: RESOURCE_NAMES[resourceType] || 'unknown',
              quantity: quantity.toString(),
              pricePerUnit: (offer.pricePerUnit ?? offer[3] ?? 0).toString(),
              sellerAddress: offer.seller ?? offer[0] ?? '',
            });
          }
        } catch {
          // offer may not exist
        }
      }
    } catch (error) {
      this.logger.warn(`Failed to fetch trade offers: ${error.message}`);
    }

    for (const agent of agents) {
      try {
        const onChain = await this.blockchainService.getAgent(agent.address);
        if (!onChain || !onChain.active) continue;

        const strategyType = Number(onChain.strategyType);
        const deposit = Number(onChain.deposit);
        const yieldEarned = Number(onChain.yieldEarned);

        // Get all 4 resource balances
        const resources: { wood: number; steel: number; energy: number; food: number } = {
          wood: 0, steel: 0, energy: 0, food: 0,
        };
        const resourceValues: number[] = [];
        for (let i = 0; i < 4; i++) {
          const bal = await this.blockchainService.getAgentResources(agent.address, i);
          const val = Number(bal);
          resourceValues.push(val);
        }
        resources.wood = resourceValues[0];
        resources.steel = resourceValues[1];
        resources.energy = resourceValues[2];
        resources.food = resourceValues[3];

        // Get FLOW balance
        let flowBalance = '0';
        try {
          flowBalance = await this.blockchainService.getBalance(agent.address);
        } catch {
          flowBalance = '0';
        }

        // Compute score
        const score = deposit + yieldEarned + (resources.wood * 10 + resources.steel * 15 + resources.energy * 20 + resources.food * 10);

        // Leaderboard position
        const position = agentScores.findIndex((a) => a.playerId === agent.playerId) + 1;

        // Recent history from transaction logs
        let recentHistory: string[] = [];
        try {
          const logs = await this.txLogService.getRecentLogs(agent.playerId, 5);
          recentHistory = logs.map((l) => `${l.action}: ${l.details || '{}'}`);
        } catch {
          recentHistory = [];
        }

        // Compute survival context
        const burnRate = BURN_RATES[strategyType] ?? BURN_RATES[1];
        const foodBurnRate = Number(burnRate.food);
        const energyBurnRate = Number(burnRate.energy);
        const cyclesOfFoodLeft = foodBurnRate > 0 ? Math.floor(resources.food / foodBurnRate) : 999;
        const cyclesOfEnergyLeft = energyBurnRate > 0 ? Math.floor(resources.energy / energyBurnRate) : 999;
        const aliveAgentCount = agents.length;

        // Build context
        const context: AgentDecisionContext = {
          agentId: agent.playerId,
          strategy: STRATEGY_NAMES[strategyType] || 'Balanced',
          strategyType,
          resources,
          deposit,
          yieldEarned,
          flowBalance,
          score,
          leaderboardPosition: position || agents.length,
          totalAgents: agents.length,
          activeTradeOffers: activeOffers,
          recentHistory,
          foodBurnRate,
          energyBurnRate,
          cyclesOfFoodLeft,
          cyclesOfEnergyLeft,
          aliveAgentCount,
          cyclesSurvived: agent.cyclesSurvived ?? 0,
        };

        // Get AI decision
        const decision = await this.aiReasoningService.decideAgentAction(context);
        this.logger.log(`Agent ${agent.playerId} AI decision: ${decision.action} - ${decision.reasoning}`);

        // Execute the decision
        await this.executeDecision(agent, onChain, decision, strategyType, resourceValues);

        // Track the action
        await this.agentActionService.updateAction(
          agent.playerId,
          decision.action,
          decision.reasoning,
          undefined,
          decision.details.resourceToGather ?? decision.details.tradeResourceType,
        );

      } catch (error) {
        this.logger.error(`Failed to run decisions for ${agent.playerId}: ${error.message}`);
      }
    }

    this.logger.log('Agent decision cycle complete');
  }

  private async executeDecision(
    agent: any,
    onChain: any,
    decision: { action: string; details: any; reasoning: string },
    strategyType: number,
    resourceValues: number[],
  ) {
    switch (decision.action) {
      case 'gather': {
        const yieldEarned = BigInt(onChain.yieldEarned);
        if (yieldEarned === 0n) {
          this.logger.log(`Agent ${agent.playerId}: no yield to convert to resources, skipping gather`);
          break;
        }

        // Determine which resource to gather
        let resourceType = decision.details.resourceToGather;
        if (resourceType === undefined || resourceType < 0 || resourceType > 3) {
          // Fall back to strategy-weighted random
          const weights = RESOURCE_WEIGHTS[strategyType] ?? RESOURCE_WEIGHTS[1];
          const totalWeight = weights.reduce((a, b) => a + b, 0);
          const roll = Math.random() * totalWeight;
          let cumulative = 0;
          resourceType = 0;
          for (let i = 0; i < 4; i++) {
            cumulative += weights[i];
            if (roll < cumulative) {
              resourceType = i;
              break;
            }
          }
        }

        // Mint resources based on yield earned
        const weights = RESOURCE_WEIGHTS[strategyType] ?? RESOURCE_WEIGHTS[1];
        const totalWeight = weights.reduce((a, b) => a + b, 0);
        const resourceAmount = (yieldEarned * BigInt(weights[resourceType])) / BigInt(totalWeight * 100);
        if (resourceAmount > 0n) {
          const mintData = this.blockchainService.encodeMintResources(
            agent.address,
            resourceType,
            resourceAmount,
          );
          await this.blockchainService.ownerSendTransaction(
            this.blockchainService.getAgentTradingAddress(),
            mintData,
          );
        }

        await this.txLogService.log(agent.playerId, agent.address, 'resources_gathered', '', {
          resourceType,
          resourceName: RESOURCE_NAMES[resourceType],
          amount: resourceAmount.toString(),
          reasoning: decision.reasoning,
        });

        this.logger.log(`Gathered ${resourceAmount} ${RESOURCE_NAMES[resourceType]} for agent ${agent.playerId}`);
        break;
      }

      case 'trade': {
        const details = decision.details;
        if (details.tradeAction === 'create_offer') {
          const resType = details.tradeResourceType ?? 0;
          const quantity = BigInt(details.tradeQuantity ?? 100);
          const price = BigInt(details.tradePricePerUnit ?? 1);

          const tradeData = this.blockchainService.encodeCreateOffer(agent.address, resType, quantity, price);
          await this.blockchainService.ownerSendTransaction(
            this.blockchainService.getAgentTradingAddress(),
            tradeData,
          );

          await this.txLogService.log(agent.playerId, agent.address, 'trade_create_offer', '', {
            resourceType: resType,
            resourceName: RESOURCE_NAMES[resType],
            quantity: quantity.toString(),
            pricePerUnit: price.toString(),
            reasoning: decision.reasoning,
          });

          this.logger.log(`Agent ${agent.playerId} created trade offer: ${quantity} ${RESOURCE_NAMES[resType]} at ${price}/unit`);
        } else if (details.tradeAction === 'accept_offer') {
          const offerId = BigInt(details.tradeOfferId ?? 0);
          const quantity = BigInt(details.tradeQuantity ?? 1);

          const tradeData = this.blockchainService.encodeExecuteTrade(agent.address, offerId, quantity);
          await this.blockchainService.ownerSendTransaction(
            this.blockchainService.getAgentTradingAddress(),
            tradeData,
          );

          await this.txLogService.log(agent.playerId, agent.address, 'trade_accept_offer', '', {
            offerId: offerId.toString(),
            quantity: quantity.toString(),
            reasoning: decision.reasoning,
          });

          this.logger.log(`Agent ${agent.playerId} accepted trade offer #${offerId} for ${quantity} units`);
        }
        break;
      }

      case 'change_strategy': {
        const newStrategy = decision.details.newStrategy ?? 1;
        if (newStrategy < 0 || newStrategy > 2) break;

        const stratData = this.blockchainService.encodeSetStrategy(agent.address, newStrategy);
        await this.blockchainService.ownerSendTransaction(
          this.blockchainService.getNeonNexusAddress(),
          stratData,
        );

        // Update agent in DB
        await this.agentService.updateStrategy(agent.playerId, newStrategy);

        await this.txLogService.log(agent.playerId, agent.address, 'strategy_changed', '', {
          oldStrategy: strategyType,
          newStrategy,
          reasoning: decision.reasoning,
        });

        this.logger.log(`Agent ${agent.playerId} changed strategy to ${STRATEGY_NAMES[newStrategy]}`);
        break;
      }

      case 'trigger_event': {
        const eventType = decision.details.eventType ?? Math.floor(Math.random() * 4);

        // Commit event
        const commitData = this.blockchainService.encodeCommitEvent(agent.address, eventType);
        await this.blockchainService.ownerSendTransaction(
          this.blockchainService.getRandomEventsAddress(),
          commitData,
        );

        // Wait before revealing
        await new Promise((resolve) => setTimeout(resolve, 5000));

        // Reveal event
        const revealData = this.blockchainService.encodeRevealEvent(agent.address);
        await this.blockchainService.ownerSendTransaction(
          this.blockchainService.getRandomEventsAddress(),
          revealData,
        );

        await this.txLogService.log(agent.playerId, agent.address, 'event_triggered', '', {
          eventType,
          reasoning: decision.reasoning,
        });

        this.logger.log(`Agent ${agent.playerId} triggered event type ${eventType}`);
        break;
      }

      case 'idle':
      default: {
        await this.txLogService.log(agent.playerId, agent.address, 'idle', '', {
          reasoning: decision.reasoning,
        });
        this.logger.log(`Agent ${agent.playerId} idling: ${decision.reasoning}`);
        break;
      }
    }
  }

  private async autoTrade(agentAddress: string) {
    try {
      const energyBalance = await this.blockchainService.getAgentResources(agentAddress, 2);
      if (energyBalance <= 100n) return;

      const sellAmount = energyBalance / 2n;
      // createOffer is onlyOwner
      const data = this.blockchainService.encodeCreateOffer(agentAddress, 2, sellAmount, 1n);
      await this.blockchainService.ownerSendTransaction(
        this.blockchainService.getAgentTradingAddress(),
        data,
      );

      this.logger.log(`Auto-trade: ${agentAddress} listed ${sellAmount} energy for sale`);
    } catch (error) {
      this.logger.error(`Auto-trade failed for ${agentAddress}: ${error.message}`);
    }
  }
}
