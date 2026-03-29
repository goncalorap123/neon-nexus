import { Injectable } from '@nestjs/common';
import { ethers } from 'ethers';
import { PrivyService } from '../privy/privy.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { getEnvConfig } from '../config/env.config';

@Injectable()
export class RandomService {
  constructor(
    private readonly privyService: PrivyService,
    private readonly blockchainService: BlockchainService,
  ) {}

  async commitEvent(walletId: string, secret: bigint): Promise<{ txHash: string; commitment: string }> {
    const config = getEnvConfig();
    const commitment = ethers.keccak256(ethers.AbiCoder.defaultAbiCoder().encode(['uint256'], [secret]));

    const data = this.blockchainService.encodeCommitEvent(commitment);
    const tx = await this.privyService.sendTransaction(
      walletId,
      this.blockchainService.getRandomEventsAddress(),
      data,
      config.FLOW_CHAIN_ID,
    );

    return { txHash: tx.hash, commitment };
  }

  async revealEvent(walletId: string, secret: bigint): Promise<{ txHash: string }> {
    const config = getEnvConfig();
    const data = this.blockchainService.encodeRevealEvent(secret);
    const tx = await this.privyService.sendTransaction(
      walletId,
      this.blockchainService.getRandomEventsAddress(),
      data,
      config.FLOW_CHAIN_ID,
    );

    return { txHash: tx.hash };
  }
}
