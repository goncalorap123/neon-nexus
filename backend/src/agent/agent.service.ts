import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrivyService } from '../privy/privy.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AgentEntity } from '../database/entities/agent.entity';
import { TransactionLogService } from '../database/transaction-log.service';
import { getEnvConfig } from '../config/env.config';

// Starting resources for all agents
const STARTING_RESOURCES = {
  wood: 50n,
  steel: 50n,
  energy: 100n,
  food: 100n,
};

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    private readonly privyService: PrivyService,
    private readonly blockchainService: BlockchainService,
    private readonly txLogService: TransactionLogService,
  ) {}

  async createAgent(playerId: string): Promise<{ walletId: string; address: string; txHash: string }> {
    const existing = await this.agentRepo.findOneBy({ playerId });
    if (existing) {
      return { walletId: existing.walletId, address: existing.address, txHash: '' };
    }

    const wallet = await this.privyService.createWallet();

    const data = this.blockchainService.encodeRegisterAgent(wallet.address, wallet.address);
    const tx = await this.blockchainService.ownerSendTransaction(
      this.blockchainService.getNeonNexusAddress(),
      data,
    );

    // Fund the agent wallet with 10 FLOW
    const fundTx = await this.blockchainService.fundWallet(wallet.address, '10');

    // Log agent creation
    await this.txLogService.log(playerId, wallet.address, 'agent_created', tx.hash, {
      walletId: wallet.id,
      address: wallet.address,
    });

    // Log wallet funding
    await this.txLogService.log(playerId, wallet.address, 'wallet_funded', fundTx.hash, {
      amount: '10 FLOW',
    });

    const agent = this.agentRepo.create({
      playerId,
      walletId: wallet.id,
      address: wallet.address,
    });
    await this.agentRepo.save(agent);

    // Seed starting resources
    await this.seedResources(wallet.address);

    return { walletId: wallet.id, address: wallet.address, txHash: tx.hash };
  }

  async getAgentEntity(playerId: string): Promise<AgentEntity | null> {
    return this.agentRepo.findOneBy({ playerId });
  }

  async getAgent(playerId: string): Promise<any> {
    const agent = await this.agentRepo.findOneBy({ playerId });
    if (!agent) {
      return null;
    }

    const onChainState = await this.blockchainService.getAgent(agent.address);
    return {
      playerId,
      walletId: agent.walletId,
      address: agent.address,
      onChain: onChainState,
    };
  }

  async deposit(playerId: string, amount: bigint): Promise<{ txHash: string }> {
    const agent = await this.agentRepo.findOneBy({ playerId });
    if (!agent) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    const data = this.blockchainService.encodeDeposit(agent.address, amount);
    const tx = await this.blockchainService.ownerSendTransaction(
      this.blockchainService.getNeonNexusAddress(),
      data,
    );

    return { txHash: tx.hash };
  }

  async setStrategy(playerId: string, strategy: number): Promise<{ txHash: string }> {
    const agent = await this.agentRepo.findOneBy({ playerId });
    if (!agent) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    const data = this.blockchainService.encodeSetStrategy(agent.address, strategy);
    const tx = await this.blockchainService.ownerSendTransaction(
      this.blockchainService.getNeonNexusAddress(),
      data,
    );

    await this.txLogService.log(playerId, agent.address, 'strategy_changed', tx.hash, {
      strategy,
      strategyName: ['Conservative', 'Balanced', 'Aggressive'][strategy],
    });

    agent.strategyType = strategy;
    await this.agentRepo.save(agent);

    return { txHash: tx.hash };
  }

  async getWalletInfo(playerId: string): Promise<{ walletId: string; address: string } | null> {
    const agent = await this.agentRepo.findOneBy({ playerId });
    if (!agent) return null;
    return { walletId: agent.walletId, address: agent.address };
  }

  async getFlowBalance(playerId: string): Promise<string> {
    const agent = await this.agentRepo.findOneBy({ playerId });
    if (!agent) return '0';
    return this.blockchainService.getBalance(agent.address);
  }

  async getAllAgents(): Promise<AgentEntity[]> {
    return this.agentRepo.find({ where: { active: true } });
  }

  async getAllPlayerIds(): Promise<string[]> {
    const agents = await this.agentRepo.find({ where: { active: true } });
    return agents.map((a) => a.playerId);
  }

  async updateStrategy(playerId: string, strategyType: number): Promise<void> {
    const agent = await this.agentRepo.findOneBy({ playerId });
    if (!agent) return;
    agent.strategyType = strategyType;
    await this.agentRepo.save(agent);
  }

  // Seed starting resources (wood=50, steel=50, energy=100, food=100)
  private async seedResources(address: string): Promise<void> {
    const resources = [
      { type: 0, amount: STARTING_RESOURCES.wood },   // wood
      { type: 1, amount: STARTING_RESOURCES.steel },   // steel
      { type: 2, amount: STARTING_RESOURCES.energy },  // energy
      { type: 3, amount: STARTING_RESOURCES.food },    // food
    ];

    for (const r of resources) {
      const data = this.blockchainService.encodeMintResources(address, r.type, r.amount);
      await this.blockchainService.ownerSendTransaction(
        this.blockchainService.getAgentTradingAddress(),
        data,
      );
    }
  }

  // Create house-owned AI agents for a round
  async createHouseAgents(count: number, depositAmount: bigint): Promise<AgentEntity[]> {
    const created: AgentEntity[] = [];

    for (let i = 0; i < count; i++) {
      const playerId = `house-agent-${Date.now()}-${i}`;
      const wallet = await this.privyService.createWallet();

      // Register on-chain
      const regData = this.blockchainService.encodeRegisterAgent(wallet.address, wallet.address);
      await this.blockchainService.ownerSendTransaction(
        this.blockchainService.getNeonNexusAddress(),
        regData,
      );

      // Fund with FLOW
      await this.blockchainService.fundWallet(wallet.address, '10');

      // Random strategy (0-2)
      const strategy = Math.floor(Math.random() * 3);
      const stratData = this.blockchainService.encodeSetStrategy(wallet.address, strategy);
      await this.blockchainService.ownerSendTransaction(
        this.blockchainService.getNeonNexusAddress(),
        stratData,
      );

      // Deposit stablecoins if amount > 0
      if (depositAmount > 0n) {
        const depData = this.blockchainService.encodeDeposit(wallet.address, depositAmount);
        await this.blockchainService.ownerSendTransaction(
          this.blockchainService.getNeonNexusAddress(),
          depData,
        );
      }

      const agent = this.agentRepo.create({
        playerId,
        walletId: wallet.id,
        address: wallet.address,
        strategyType: strategy,
        isHouseAgent: true,
      });
      await this.agentRepo.save(agent);

      // Seed starting resources
      await this.seedResources(wallet.address);

      await this.txLogService.log(playerId, wallet.address, 'house_agent_created', '', {
        strategy,
        strategyName: ['Conservative', 'Balanced', 'Aggressive'][strategy],
      });

      this.logger.log(`Created house agent ${playerId} with strategy ${['Conservative', 'Balanced', 'Aggressive'][strategy]}`);
      created.push(agent);
    }

    return created;
  }

  // Eliminate an agent (DB side)
  async eliminateAgent(playerId: string): Promise<void> {
    const agent = await this.agentRepo.findOneBy({ playerId });
    if (!agent) return;
    agent.active = false;
    agent.eliminated = true;
    agent.eliminatedAt = new Date();
    await this.agentRepo.save(agent);
  }

  // Get all alive (active, non-eliminated) agents
  async getAliveAgents(): Promise<AgentEntity[]> {
    return this.agentRepo.find({ where: { active: true, eliminated: false } });
  }

  // Get count of alive agents
  async getAliveCount(): Promise<number> {
    return this.agentRepo.count({ where: { active: true, eliminated: false } });
  }

  // Increment cycles survived for an agent
  async incrementCyclesSurvived(playerId: string): Promise<void> {
    const agent = await this.agentRepo.findOneBy({ playerId });
    if (!agent) return;
    agent.cyclesSurvived += 1;
    await this.agentRepo.save(agent);
  }

  // Get all house agents
  async getHouseAgents(): Promise<AgentEntity[]> {
    return this.agentRepo.find({ where: { isHouseAgent: true } });
  }

  // Check if a given playerId is a house agent
  async isHouseAgent(playerId: string): Promise<boolean> {
    const agent = await this.agentRepo.findOneBy({ playerId });
    return agent?.isHouseAgent ?? false;
  }

  // Get all agents (including eliminated) for leaderboard
  async getAllAgentsIncludingEliminated(): Promise<AgentEntity[]> {
    return this.agentRepo.find();
  }
}
