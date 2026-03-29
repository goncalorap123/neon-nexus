import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrivyService } from '../privy/privy.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AgentEntity } from '../database/entities/agent.entity';
import { TransactionLogService } from '../database/transaction-log.service';
import { getEnvConfig } from '../config/env.config';

@Injectable()
export class AgentService {
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

    return { walletId: wallet.id, address: wallet.address, txHash: tx.hash };
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
}
