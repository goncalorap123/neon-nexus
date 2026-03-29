import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PrivyService } from '../privy/privy.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { AgentEntity } from '../database/entities/agent.entity';
import { getEnvConfig } from '../config/env.config';

@Injectable()
export class AgentService {
  constructor(
    @InjectRepository(AgentEntity)
    private readonly agentRepo: Repository<AgentEntity>,
    private readonly privyService: PrivyService,
    private readonly blockchainService: BlockchainService,
  ) {}

  async createAgent(playerId: string): Promise<{ walletId: string; address: string; txHash: string }> {
    const existing = await this.agentRepo.findOneBy({ playerId });
    if (existing) {
      return { walletId: existing.walletId, address: existing.address, txHash: '' };
    }

    const wallet = await this.privyService.createWallet();

    const config = getEnvConfig();
    const data = this.blockchainService.encodeRegisterAgent(wallet.address, wallet.address);
    const tx = await this.privyService.sendTransaction(
      wallet.address,
      this.blockchainService.getNeonNexusAddress(),
      data,
      config.FLOW_CHAIN_ID,
    );

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

    const config = getEnvConfig();
    const data = this.blockchainService.encodeDeposit(agent.address, amount);
    const tx = await this.privyService.sendTransaction(
      agent.address,
      this.blockchainService.getNeonNexusAddress(),
      data,
      config.FLOW_CHAIN_ID,
    );

    return { txHash: tx.hash };
  }

  async setStrategy(playerId: string, strategy: number): Promise<{ txHash: string }> {
    const agent = await this.agentRepo.findOneBy({ playerId });
    if (!agent) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    const config = getEnvConfig();
    const data = this.blockchainService.encodeSetStrategy(agent.address, strategy);
    const tx = await this.privyService.sendTransaction(
      agent.address,
      this.blockchainService.getNeonNexusAddress(),
      data,
      config.FLOW_CHAIN_ID,
    );

    agent.strategyType = strategy;
    await this.agentRepo.save(agent);

    return { txHash: tx.hash };
  }

  async getWalletInfo(playerId: string): Promise<{ walletId: string; address: string } | null> {
    const agent = await this.agentRepo.findOneBy({ playerId });
    if (!agent) return null;
    return { walletId: agent.walletId, address: agent.address };
  }

  async getAllAgents(): Promise<AgentEntity[]> {
    return this.agentRepo.find({ where: { active: true } });
  }

  async getAllPlayerIds(): Promise<string[]> {
    const agents = await this.agentRepo.find({ where: { active: true } });
    return agents.map((a) => a.playerId);
  }
}
