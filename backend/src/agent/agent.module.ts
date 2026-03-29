import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AgentController } from './agent.controller';
import { AgentService } from './agent.service';
import { AgentEntity } from '../database/entities/agent.entity';
import { TransactionLogEntity } from '../database/entities/transaction-log.entity';
import { TransactionLogService } from '../database/transaction-log.service';
import { PrivyModule } from '../privy/privy.module';
import { BlockchainModule } from '../blockchain/blockchain.module';
import { DatabaseModule } from '../database/database.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AgentEntity, TransactionLogEntity]),
    PrivyModule,
    BlockchainModule,
    DatabaseModule,
  ],
  controllers: [AgentController],
  providers: [AgentService, TransactionLogService],
  exports: [AgentService],
})
export class AgentModule {}
