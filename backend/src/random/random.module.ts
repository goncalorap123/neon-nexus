import { Module } from '@nestjs/common';
import { RandomService } from './random.service';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [BlockchainModule],
  providers: [RandomService],
  exports: [RandomService],
})
export class RandomModule {}
