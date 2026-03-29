import { Module } from '@nestjs/common';
import { GameController } from './game.controller';
import { GameService } from './game.service';
import { AgentModule } from '../agent/agent.module';
import { RandomModule } from '../random/random.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [AgentModule, RandomModule, BlockchainModule],
  controllers: [GameController],
  providers: [GameService],
  exports: [GameService],
})
export class GameModule {}
