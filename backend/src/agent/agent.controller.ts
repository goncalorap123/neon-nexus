import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { AgentService } from './agent.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { TransactionLogService } from '../database/transaction-log.service';
import { ApiKeyGuard } from '../auth/api-key.guard';

@Controller('api/agent')
@UseGuards(ApiKeyGuard)
export class AgentController {
  constructor(
    private readonly agentService: AgentService,
    private readonly blockchainService: BlockchainService,
    private readonly txLogService: TransactionLogService,
  ) {}

  @Post('create')
  async createAgent(@Body() body: { playerId: string }) {
    const result = await this.agentService.createAgent(body.playerId);
    return { success: true, data: result };
  }

  @Get(':playerId')
  async getAgent(@Param('playerId') playerId: string) {
    const agent = await this.agentService.getAgent(playerId);
    if (!agent) {
      return { success: false, error: 'Agent not found' };
    }
    return { success: true, data: agent };
  }

  @Post('deposit')
  async deposit(@Body() body: { playerId: string; amount: string }) {
    const result = await this.agentService.deposit(body.playerId, BigInt(body.amount));
    return { success: true, data: result };
  }

  @Post('set-strategy')
  async setStrategy(@Body() body: { playerId: string; strategy: number }) {
    const result = await this.agentService.setStrategy(body.playerId, body.strategy);
    return { success: true, data: result };
  }

  @Get(':playerId/history')
  async getHistory(@Param('playerId') playerId: string) {
    const history = await this.txLogService.getHistory(playerId);
    return { success: true, data: history };
  }

  @Get(':playerId/balance')
  async getBalance(@Param('playerId') playerId: string) {
    const balance = await this.agentService.getFlowBalance(playerId);
    return { success: true, data: { flowBalance: balance } };
  }

  @Post('spawn-house-agents')
  async spawnHouseAgents(@Body() body: { count?: number }) {
    const count = body.count ?? 5;
    const agents = await this.agentService.createHouseAgents(count, 0n);
    return { success: true, data: { spawned: agents.length } };
  }

  @Post('remove-agent')
  async removeAgent(@Body() body: { playerId: string }) {
    await this.agentService.removeAgent(body.playerId);
    return { success: true };
  }

  @Post('fund-all-agents')
  async fundAllAgents() {
    const agents = await this.agentService.getAliveAgents();
    let funded = 0;
    for (const agent of agents) {
      try {
        const onChain = await this.blockchainService.getAgent(agent.address);
        if (Number(onChain?.deposit ?? 0) === 0) {
          await this.agentService.fundAndDeposit(agent.address, 1_000_000_000n);
          funded++;
        }
      } catch (e) {
        console.error(`Failed to fund ${agent.playerId}: ${e.message}`);
      }
    }
    return { success: true, data: { funded } };
  }
}
