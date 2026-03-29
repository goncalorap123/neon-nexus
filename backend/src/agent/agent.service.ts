import { Injectable } from '@nestjs/common';
import { PrivyService } from '../privy/privy.service';
import { BlockchainService } from '../blockchain/blockchain.service';
import { getEnvConfig } from '../config/env.config';

@Injectable()
export class AgentService {
  // In-memory mapping of playerId -> walletId
  private playerWallets = new Map<string, { walletId: string; address: string }>();

  constructor(
    private readonly privyService: PrivyService,
    private readonly blockchainService: BlockchainService,
  ) {}

  async createAgent(playerId: string): Promise<{ walletId: string; address: string; txHash: string }> {
    const wallet = await this.privyService.createWallet();
    this.playerWallets.set(playerId, { walletId: wallet.id, address: wallet.address });

    const config = getEnvConfig();
    // Use the agent wallet as both player and agent address for on-chain registration
    // (player address is a Roblox ID mapped off-chain; on-chain we just need the wallet registered)
    const data = this.blockchainService.encodeRegisterAgent(wallet.address, wallet.address);
    const tx = await this.privyService.sendTransaction(
      wallet.id,
      this.blockchainService.getNeonNexusAddress(),
      data,
      config.FLOW_CHAIN_ID,
    );

    return { walletId: wallet.id, address: wallet.address, txHash: tx.hash };
  }

  async getAgent(playerId: string): Promise<any> {
    const walletInfo = this.playerWallets.get(playerId);
    if (!walletInfo) {
      return null;
    }

    const onChainState = await this.blockchainService.getAgent(walletInfo.address);
    return {
      playerId,
      walletId: walletInfo.walletId,
      address: walletInfo.address,
      onChain: onChainState,
    };
  }

  async deposit(playerId: string, amount: bigint): Promise<{ txHash: string }> {
    const walletInfo = this.playerWallets.get(playerId);
    if (!walletInfo) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    const config = getEnvConfig();
    const data = this.blockchainService.encodeDeposit(walletInfo.address, amount);
    const tx = await this.privyService.sendTransaction(
      walletInfo.walletId,
      this.blockchainService.getNeonNexusAddress(),
      data,
      config.FLOW_CHAIN_ID,
    );

    return { txHash: tx.hash };
  }

  async setStrategy(playerId: string, strategy: number): Promise<{ txHash: string }> {
    const walletInfo = this.playerWallets.get(playerId);
    if (!walletInfo) {
      throw new Error(`No wallet found for player ${playerId}`);
    }

    const config = getEnvConfig();
    const data = this.blockchainService.encodeSetStrategy(walletInfo.address, strategy);
    const tx = await this.privyService.sendTransaction(
      walletInfo.walletId,
      this.blockchainService.getNeonNexusAddress(),
      data,
      config.FLOW_CHAIN_ID,
    );

    return { txHash: tx.hash };
  }

  getWalletInfo(playerId: string): { walletId: string; address: string } | undefined {
    return this.playerWallets.get(playerId);
  }

  getAllPlayerIds(): string[] {
    return Array.from(this.playerWallets.keys());
  }
}
