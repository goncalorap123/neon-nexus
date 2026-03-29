import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { AgentModule } from '../agent/agent.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [AgentModule, BlockchainModule, DatabaseModule],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
