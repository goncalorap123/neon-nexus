import { Module } from '@nestjs/common';
import { RandomService } from './random.service';
import { PrivyModule } from '../privy/privy.module';
import { BlockchainModule } from '../blockchain/blockchain.module';

@Module({
  imports: [PrivyModule, BlockchainModule],
  providers: [RandomService],
  exports: [RandomService],
})
export class RandomModule {}
