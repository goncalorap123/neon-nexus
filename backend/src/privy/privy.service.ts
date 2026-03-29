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
    const config = getEnvConfig();
    const wallet = await this.client.walletApi.create({
      chainType: 'ethereum',
      authorizationKeyIds: undefined,
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
    const config = getEnvConfig();
    const result = await this.client.walletApi.rpc({
      walletId,
      method: 'eth_sendTransaction',
      caip2: `eip155:${chainId}`,
      params: {
        transaction: {
          to,
          data,
        },
      },
    });
    return { hash: result.data.hash };
  }
}
