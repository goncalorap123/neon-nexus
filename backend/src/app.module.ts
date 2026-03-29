import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { DatabaseModule } from './database/database.module';
import { PrivyModule } from './privy/privy.module';
import { BlockchainModule } from './blockchain/blockchain.module';
import { AgentModule } from './agent/agent.module';
import { GameModule } from './game/game.module';
import { RandomModule } from './random/random.module';
import { SettlementModule } from './settlement/settlement.module';
import { TradingModule } from './trading/trading.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    DatabaseModule,
    PrivyModule,
    BlockchainModule,
    AgentModule,
    GameModule,
    RandomModule,
    SettlementModule,
    TradingModule,
  ],
})
export class AppModule {}
