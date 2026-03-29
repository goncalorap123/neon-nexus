import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from './entities/agent.entity';
import { TradeOfferEntity } from './entities/trade-offer.entity';
import { TransactionLogEntity } from './entities/transaction-log.entity';
import { AgentActionEntity } from './entities/agent-action.entity';
import { TransactionLogService } from './transaction-log.service';
import { AgentActionService } from './agent-action.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqljs',
      autoSave: true,
      location: 'neon-nexus.db',
      entities: [AgentEntity, TradeOfferEntity, TransactionLogEntity, AgentActionEntity],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([AgentEntity, TradeOfferEntity, TransactionLogEntity, AgentActionEntity]),
  ],
  providers: [TransactionLogService, AgentActionService],
  exports: [TypeOrmModule, TransactionLogService, AgentActionService],
})
export class DatabaseModule {}
