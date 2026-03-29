import { Controller, Post, Get, Body, Param, UseGuards } from '@nestjs/common';
import { AgentService } from './agent.service';
import { ApiKeyGuard } from '../auth/api-key.guard';

@Controller('api/agent')
@UseGuards(ApiKeyGuard)
export class AgentController {
  constructor(private readonly agentService: AgentService) {}

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
}
