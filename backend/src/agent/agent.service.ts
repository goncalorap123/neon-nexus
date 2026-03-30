import { Injectable, Logger } from '@nestjs/common';
import { ethers } from 'ethers';
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
  energy: 80n,
  food: 80n,
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

    // Seed resources + fund deposit in one batch
    const depositAmt = 1_000_000_000n;
    const config = getEnvConfig();
    const deployAddr = new ethers.Wallet(config.DEPLOY_WALLET_KEY).address;
    const neonNexus = this.blockchainService.getNeonNexusAddress();
    const depositToken = this.blockchainService.getDepositTokenAddress();
    const agentTrading = this.blockchainService.getAgentTradingAddress();

    await this.blockchainService.ownerSendBatch([
      { to: agentTrading, data: this.blockchainService.encodeMintResources(wallet.address, 0, STARTING_RESOURCES.wood) },
      { to: agentTrading, data: this.blockchainService.encodeMintResources(wallet.address, 1, STARTING_RESOURCES.steel) },
      { to: agentTrading, data: this.blockchainService.encodeMintResources(wallet.address, 2, STARTING_RESOURCES.energy) },
      { to: agentTrading, data: this.blockchainService.encodeMintResources(wallet.address, 3, STARTING_RESOURCES.food) },
      { to: depositToken, data: this.blockchainService.encodeMintToken(deployAddr, depositAmt) },
      { to: depositToken, data: this.blockchainService.encodeApproveToken(neonNexus, depositAmt) },
      { to: neonNexus, data: this.blockchainService.encodeDeposit(wallet.address, depositAmt) },
    ]);

    // Spawn house agents if this is the first player agent
    const houseAgents = await this.agentRepo.find({ where: { isHouseAgent: true } });
    if (houseAgents.length === 0) {
      this.logger.log('First player agent created — spawning house agents...');
      // Spawn in background so the player doesn't wait
      this.createHouseAgents(5, 0n).catch((err) => {
        this.logger.error(`Failed to create house agents: ${err.message}`);
      });
    }

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

  // Mint deposit tokens to the deploy wallet, approve NeonNexus, then deposit for an agent
  async fundAndDeposit(address: string, amount: bigint): Promise<void> {
    const config = getEnvConfig();
    const deployWalletAddress = new ethers.Wallet(config.DEPLOY_WALLET_KEY).address;

    // 1. Mint tokens to the deploy wallet
    const mintData = this.blockchainService.encodeMintToken(deployWalletAddress, amount);
    await this.blockchainService.ownerSendTransaction(
      this.blockchainService.getDepositTokenAddress(),
      mintData,
    );

    // 2. Approve NeonNexus to spend
    const approveData = this.blockchainService.encodeApproveToken(
      this.blockchainService.getNeonNexusAddress(),
      amount,
    );
    await this.blockchainService.ownerSendTransaction(
      this.blockchainService.getDepositTokenAddress(),
      approveData,
    );

    // 3. Deposit for the agent
    const depData = this.blockchainService.encodeDeposit(address, amount);
    await this.blockchainService.ownerSendTransaction(
      this.blockchainService.getNeonNexusAddress(),
      depData,
    );

    this.logger.log(`Funded and deposited ${amount} tokens for ${address}`);
  }

  async removeAgent(playerId: string): Promise<void> {
    await this.agentRepo.delete({ playerId });
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

  // Create house-owned AI agents for a round — batched for speed
  async createHouseAgents(count: number, depositAmount: bigint): Promise<AgentEntity[]> {
    // Guard: skip if house agents already exist
    const existing = await this.agentRepo.find({ where: { isHouseAgent: true } });
    if (existing.length >= count) {
      this.logger.log(`Already have ${existing.length} house agents, skipping spawn`);
      return existing;
    }

    this.logger.log(`Creating ${count} house agents (batched)...`);
    const depositAmt = 1_000_000_000n; // $10 in 6 decimal base units
    const config = getEnvConfig();
    const deployAddr = new ethers.Wallet(config.DEPLOY_WALLET_KEY).address;

    // 1. Create all Privy wallets in parallel
    const walletPromises = Array.from({ length: count }, () => this.privyService.createWallet());
    const wallets = await Promise.all(walletPromises);
    this.logger.log(`Created ${wallets.length} Privy wallets`);

    // 2. Prepare all on-chain txs for all agents in one batch
    const strategies = wallets.map(() => Math.floor(Math.random() * 3));
    const allTxs: Array<{ to: string; data: string }> = [];
    const neonNexus = this.blockchainService.getNeonNexusAddress();
    const agentTrading = this.blockchainService.getAgentTradingAddress();
    const depositToken = this.blockchainService.getDepositTokenAddress();

    for (let i = 0; i < wallets.length; i++) {
      const addr = wallets[i].address;
      const strategy = strategies[i];

      // Register agent
      allTxs.push({ to: neonNexus, data: this.blockchainService.encodeRegisterAgent(addr, addr) });
      // Set strategy
      allTxs.push({ to: neonNexus, data: this.blockchainService.encodeSetStrategy(addr, strategy) });
      // Mint deposit tokens to deploy wallet
      allTxs.push({ to: depositToken, data: this.blockchainService.encodeMintToken(deployAddr, depositAmt) });
      // Approve NeonNexus to spend
      allTxs.push({ to: depositToken, data: this.blockchainService.encodeApproveToken(neonNexus, depositAmt) });
      // Deposit for agent
      allTxs.push({ to: neonNexus, data: this.blockchainService.encodeDeposit(addr, depositAmt) });
      // Mint starting resources (wood=0, steel=1, energy=2, food=3)
      allTxs.push({ to: agentTrading, data: this.blockchainService.encodeMintResources(addr, 0, STARTING_RESOURCES.wood) });
      allTxs.push({ to: agentTrading, data: this.blockchainService.encodeMintResources(addr, 1, STARTING_RESOURCES.steel) });
      allTxs.push({ to: agentTrading, data: this.blockchainService.encodeMintResources(addr, 2, STARTING_RESOURCES.energy) });
      allTxs.push({ to: agentTrading, data: this.blockchainService.encodeMintResources(addr, 3, STARTING_RESOURCES.food) });
    }

    // 3. Fire all txs with nonce management, wait for all at end
    this.logger.log(`Sending ${allTxs.length} txs in batch...`);
    await this.blockchainService.ownerSendBatch(allTxs);
    this.logger.log(`All ${allTxs.length} txs confirmed`);

    // 4. Fund wallets with FLOW in parallel (simple transfers)
    const fundPromises = wallets.map((w) => this.blockchainService.fundWallet(w.address, '10'));
    await Promise.all(fundPromises);

    // 5. Save to DB
    const created: AgentEntity[] = [];
    for (let i = 0; i < wallets.length; i++) {
      const playerId = `house-agent-${Date.now()}-${i}`;
      const agent = this.agentRepo.create({
        playerId,
        walletId: wallets[i].id,
        address: wallets[i].address,
        strategyType: strategies[i],
        isHouseAgent: true,
      });
      await this.agentRepo.save(agent);

      await this.txLogService.log(playerId, wallets[i].address, 'house_agent_created', '', {
        strategy: strategies[i],
        strategyName: ['Conservative', 'Balanced', 'Aggressive'][strategies[i]],
      });

      this.logger.log(`Created house agent ${playerId} (${['Conservative', 'Balanced', 'Aggressive'][strategies[i]]})`);
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
