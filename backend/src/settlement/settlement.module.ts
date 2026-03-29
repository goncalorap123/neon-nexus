import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { AgentModule } from '../agent/agent.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [AgentModule, BlockchainModule],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
