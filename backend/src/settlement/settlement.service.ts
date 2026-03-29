import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { AgentService } from '../agent/agent.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { PrivyService } from '../privy/privy.service';
import { getEnvConfig } from '../config/env.config';

// Yield rates per hour based on strategy (in token base units, e.g. 6 decimals)
// Conservative: 0.5%, Balanced: 1%, Aggressive: 2% (annualized, divided by 8760 hours)
const YIELD_RATES = [
  50n,   // conservative: ~0.05 tokens/hour per 1000 deposited
  100n,  // balanced: ~0.10 tokens/hour per 1000 deposited
  200n,  // aggressive: ~0.20 tokens/hour per 1000 deposited
];

// Resource distribution weights per strategy
// [wood, steel, energy, food]
const RESOURCE_WEIGHTS: Record<number, number[]> = {
  0: [30, 30, 20, 20], // conservative: balanced resources
  1: [25, 35, 25, 15], // balanced: steel-heavy for upgrades
  2: [15, 20, 45, 20], // aggressive: energy-heavy for trading
};

@Injectable()
export class SettlementService {
  private readonly logger = new Logger(SettlementService.name);

  constructor(
    private readonly agentService: AgentService,
    private readonly blockchainService: BlockchainService,
    private readonly privyService: PrivyService,
  ) {}

  @Cron(CronExpression.EVERY_HOUR)
  async distributeYield() {
    this.logger.log('Running yield distribution...');

    const agents = await this.agentService.getAllAgents();
    if (agents.length === 0) {
      this.logger.log('No active agents, skipping yield distribution');
      return;
    }

    const config = getEnvConfig();

    for (const agent of agents) {
      try {
        const onChain = await this.blockchainService.getAgent(agent.address);
        if (!onChain || !onChain.active) continue;

        const deposit = BigInt(onChain.deposit);
        if (deposit === 0n) continue;

        const strategyType = Number(onChain.strategyType);
        const yieldRate = YIELD_RATES[strategyType] ?? YIELD_RATES[1];

        // Yield = deposit * rate / 1_000_000 (scaled)
        const yieldAmount = (deposit * yieldRate) / 1_000_000n;
        if (yieldAmount === 0n) continue;

        // Distribute yield on-chain
        const yieldData = this.blockchainService.encodeDistributeYield(agent.address, yieldAmount);
        await this.privyService.sendTransaction(
          agent.address,
          this.blockchainService.getNeonNexusAddress(),
          yieldData,
          config.FLOW_CHAIN_ID,
        );

        this.logger.log(`Distributed ${yieldAmount} yield to agent ${agent.playerId} (${agent.address})`);
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

    const config = getEnvConfig();

    for (const agent of agents) {
      try {
        const onChain = await this.blockchainService.getAgent(agent.address);
        if (!onChain || !onChain.active) continue;

        const strategyType = Number(onChain.strategyType);
        const yieldEarned = BigInt(onChain.yieldEarned);

        if (yieldEarned === 0n) continue;

        // Convert yield into resources based on strategy weights
        const weights = RESOURCE_WEIGHTS[strategyType] ?? RESOURCE_WEIGHTS[1];
        const totalWeight = weights.reduce((a, b) => a + b, 0);

        for (let resourceType = 0; resourceType < 4; resourceType++) {
          const resourceAmount = (yieldEarned * BigInt(weights[resourceType])) / BigInt(totalWeight * 100);
          if (resourceAmount === 0n) continue;

          const mintData = this.blockchainService.encodeMintResources(
            agent.address,
            resourceType,
            resourceAmount,
          );

          await this.privyService.sendTransaction(
            agent.address,
            this.blockchainService.getAgentTradingAddress(),
            mintData,
            config.FLOW_CHAIN_ID,
          );
        }

        this.logger.log(`Minted resources for agent ${agent.playerId} based on strategy ${strategyType}`);

        // Aggressive agents auto-create trade offers with surplus resources
        if (strategyType === 2) {
          await this.autoTrade(agent.address, config.FLOW_CHAIN_ID);
        }
      } catch (error) {
        this.logger.error(`Failed to run decisions for ${agent.playerId}: ${error.message}`);
      }
    }

    this.logger.log('Agent decision cycle complete');
  }

  private async autoTrade(agentAddress: string, chainId: number) {
    try {
      // Check if agent has excess energy (aggressive strategy's primary resource)
      const energyBalance = await this.blockchainService.getAgentResources(agentAddress, 2);
      const threshold = 100n;

      if (energyBalance > threshold) {
        const sellAmount = energyBalance / 2n;
        const data = this.blockchainService.encodeCreateOffer(
          agentAddress,
          2, // energy
          sellAmount,
          1n, // 1 token per unit
        );

        await this.privyService.sendTransaction(
          agentAddress,
          this.blockchainService.getAgentTradingAddress(),
          data,
          chainId,
        );

        this.logger.log(`Auto-trade: ${agentAddress} listed ${sellAmount} energy for sale`);
      }
    } catch (error) {
      this.logger.error(`Auto-trade failed for ${agentAddress}: ${error.message}`);
    }
  }
}
