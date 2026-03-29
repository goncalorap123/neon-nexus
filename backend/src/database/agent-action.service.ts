import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AgentActionEntity } from './entities/agent-action.entity';

@Injectable()
export class AgentActionService {
  constructor(
    @InjectRepository(AgentActionEntity)
    private readonly actionRepo: Repository<AgentActionEntity>,
  ) {}

  async updateAction(
    playerId: string,
    currentAction: string,
    reasoning?: string,
    targetAgentId?: string,
    targetResourceType?: number,
  ): Promise<AgentActionEntity> {
    let entry = await this.actionRepo.findOneBy({ playerId });
    if (!entry) {
      entry = this.actionRepo.create({ playerId });
    }
    entry.currentAction = currentAction;
    entry.reasoning = reasoning || null;
    entry.targetAgentId = targetAgentId || null;
    entry.targetResourceType = targetResourceType ?? null;
    return this.actionRepo.save(entry);
  }

  async getAction(playerId: string): Promise<AgentActionEntity | null> {
    return this.actionRepo.findOneBy({ playerId });
  }

  async getAllActions(): Promise<AgentActionEntity[]> {
    return this.actionRepo.find();
  }
}
