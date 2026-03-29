import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { PrivyModule } from './privy/privy.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { AgentModule } from './agent/agent.module';
import { GameModule } from './game/game.module';
import { RandomModule } from './random/random.module';
import { SettlementModule } from './settlement/settlement.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    PrivyModule,
    BlockchainModule,
    AgentModule,
    GameModule,
    RandomModule,
    SettlementModule,
  ],
})
export class AppModule {}
