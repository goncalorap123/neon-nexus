import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgentService } from '../agent/agent.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { TransactionLogService } from '../database/transaction-log.service';

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

const RESOURCE_NAMES = ['wood', 'steel', 'energy', 'food'];

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly blockchainService: BlockchainService,
    private readonly txLogService: TransactionLogService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async distributeYield() {
    this.logger.log('Running yield distribution...');

    const agents = await this.agentService.getAllAgents();
    if (agents.length === 0) {
      this.logger.log('No active agents, skipping yield distribution');
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

    const agents = await this.agentService.getAllAgents();
    if (agents.length === 0) {
      this.logger.log('No active agents, skipping decision cycle');
      return;
    }

    for (const agent of agents) {
      try {
        const onChain = await this.blockchainService.getAgent(agent.address);
        if (!onChain || !onChain.active) continue;

        const strategyType = Number(onChain.strategyType);
        const yieldEarned = BigInt(onChain.yieldEarned);
        if (yieldEarned === 0n) continue;

        const weights = RESOURCE_WEIGHTS[strategyType] ?? RESOURCE_WEIGHTS[1];
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        for (let resourceType = 0; resourceType < 4; resourceType++) {
          const resourceAmount = (yieldEarned * BigInt(weights[resourceType])) / BigInt(totalWeight * 100);
          if (resourceAmount === 0n) continue;

          // mintResources is onlyOwner
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

        await this.txLogService.log(agent.playerId, agent.address, 'resources_minted', '', {
          strategyType,
          reasoning: `Strategy ${['Conservative', 'Balanced', 'Aggressive'][strategyType]} resource allocation based on yield earned`,
        });

        this.logger.log(`Minted resources for agent ${agent.playerId} based on strategy ${strategyType}`);

        // Check for surplus resources (>200) and auto-list for trade
        for (let resType = 0; resType < 4; resType++) {
          try {
            const balance = await this.blockchainService.getAgentResources(agent.address, resType);
            if (balance > 200n) {
              const sellAmount = balance - 100n; // Keep 100, sell the rest
              const tradeData = this.blockchainService.encodeCreateOffer(agent.address, resType, sellAmount, 1n);
              await this.blockchainService.ownerSendTransaction(
                this.blockchainService.getAgentTradingAddress(),
                tradeData,
              );

              await this.txLogService.log(agent.playerId, agent.address, 'auto_trade', '', {
                resource: RESOURCE_NAMES[resType],
                amount: sellAmount.toString(),
                reasoning: `Surplus detected (${balance.toString()} > 200), listing ${sellAmount.toString()} for sale`,
              });

              this.logger.log(`Auto-listed ${sellAmount} ${RESOURCE_NAMES[resType]} for agent ${agent.playerId}`);
            }
          } catch (error) {
            this.logger.error(`Failed surplus check for ${agent.playerId} resource ${resType}: ${error.message}`);
          }
        }

        if (strategyType === 2) {
          await this.autoTrade(agent.address);
        }
      } catch (error) {
        this.logger.error(`Failed to run decisions for ${agent.playerId}: ${error.message}`);
      }
    }

    this.logger.log('Agent decision cycle complete');
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
