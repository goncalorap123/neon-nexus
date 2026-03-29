import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { AgentModule } from '../agent/agent.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { DatabaseModule } from '../database/database.module';
import { AiReasoningModule } from '../ai/ai-reasoning.module';

@Module({
  imports: [AgentModule, BlockchainModule, DatabaseModule, AiReasoningModule],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
