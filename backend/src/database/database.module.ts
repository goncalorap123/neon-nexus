import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from './entities/agent.entity';
import { TradeOfferEntity } from './entities/trade-offer.entity';
import { TransactionLogEntity } from './entities/transaction-log.entity';
import { TransactionLogService } from './transaction-log.service';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqljs',
      autoSave: true,
      location: 'neon-nexus.db',
      entities: [AgentEntity, TradeOfferEntity, TransactionLogEntity],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([AgentEntity, TradeOfferEntity, TransactionLogEntity]),
  ],
  providers: [TransactionLogService],
  exports: [TypeOrmModule, TransactionLogService],
})
export class DatabaseModule {}
