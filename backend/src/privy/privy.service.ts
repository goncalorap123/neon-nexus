import { Injectable, OnModuleInit } from '@nestjs/common';
import { PrivyClient } from '@privy-io/server-auth';
import { getEnvConfig } from '../config/env.config';

@Injectable()
export class PrivyService implements OnModuleInit {
  private client: PrivyClient;

  onModuleInit() {
    const config = getEnvConfig();
    this.client = new PrivyClient(config.PRIVY_APP_ID, config.PRIVY_APP_SECRET);
  }

  async createWallet(): Promise<{ id: string; address: string }> {
    const wallet = await this.client.walletApi.create({
      chainType: 'ethereum',
    });
    return { id: wallet.id, address: wallet.address };
  }

  async getWallets(): Promise<any[]> {
    const response = await this.client.walletApi.getWallets();
    return response.data;
  }

  async sendTransaction(
    walletId: string,
    to: string,
    data: string,
    chainId: number,
  ): Promise<{ hash: string }> {
    const result = await this.client.walletApi.ethereum.sendTransaction({
      walletId: walletId,
      chainType: 'ethereum',
      caip2: `eip155:${chainId}`,
      transaction: {
        to: to as `0x${string}`,
        data: data as `0x${string}`,
      },
    });
    return { hash: result.hash };
  }
}
