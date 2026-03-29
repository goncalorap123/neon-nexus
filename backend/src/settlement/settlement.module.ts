import { Module } from '@nestjs/common';
import { SettlementService } from './settlement.service';
import { AgentModule } from '../agent/agent.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { PrivyModule } from '../privy/privy.module';

@Module({
  imports: [AgentModule, BlockchainModule, PrivyModule],
  providers: [SettlementService],
  exports: [SettlementService],
})
export class SettlementModule {}
