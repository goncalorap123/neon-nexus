import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentEntity } from './entities/agent.entity';
import { TradeOfferEntity } from './entities/trade-offer.entity';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: 'sqljs',
      autoSave: true,
      location: 'neon-nexus.db',
      entities: [AgentEntity, TradeOfferEntity],
      synchronize: true,
    }),
    TypeOrmModule.forFeature([AgentEntity, TradeOfferEntity]),
  ],
  exports: [TypeOrmModule],
})
export class DatabaseModule {}
