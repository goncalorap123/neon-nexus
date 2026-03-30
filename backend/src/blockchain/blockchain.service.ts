import { Injectable, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { getEnvConfig } from '../config/env.config';

const DEPOSIT_TOKEN_ABI = [
  'function mint(address to, uint256 amount) external',
  'function approve(address spender, uint256 amount) external returns (bool)',
  'function balanceOf(address account) external view returns (uint256)',
];

const NEON_NEXUS_ABI = [
  'function registerAgent(address player, address agentWallet) external',
  'function deposit(address agentWallet, uint256 amount) external',
  'function withdraw(address agentWallet, uint256 amount) external',
  'function distributeYield(address agentWallet, uint256 yieldAmount) external',
  'function setStrategy(address agentWallet, uint8 strategyType) external',
  'function getAgent(address agentWallet) external view returns (tuple(address wallet, uint256 deposit, uint256 yieldEarned, uint256 lastHarvest, uint8 strategyType, bool active))',
  'function totalDeposits() external view returns (uint256)',
  'function deactivateAgent(address agentWallet) external',
  'function transferYield(address from, address to, uint256 amount) external',
];

const RANDOM_EVENTS_ABI = [
  'function commitEvent(address agent, uint8 eventType) external returns (uint256)',
  'function revealEvent(address agent) external returns (uint256)',
  'function activeRequest(address agent) external view returns (uint256)',
];

const AGENT_TRADING_ABI = [
  'function createOffer(address seller, uint8 resourceType, uint256 quantity, uint256 pricePerUnit) external returns (uint256)',
  'function executeTrade(address buyer, uint256 offerId, uint256 quantity) external',
  'function mintResources(address agent, uint8 resourceType, uint256 quantity) external',
  'function cancelOffer(uint256 offerId) external',
  'function burnResources(address agent, uint8 resourceType, uint256 amount) external',
  'function agentResources(address agent, uint8 resourceType) external view returns (uint256)',
  'function offers(uint256 offerId) external view returns (address seller, uint8 resourceType, uint256 quantity, uint256 pricePerUnit, bool active)',
  'function nextOfferId() external view returns (uint256)',
];

@Injectable()
export class BlockchainService implements OnModuleInit {
  private provider: ethers.JsonRpcProvider;
  private signer: ethers.Wallet;
  private nonceLock: Promise<void> = Promise.resolve();
  private managedNonce: number = -1;
  private depositToken: ethers.Contract;
  private neonNexus: ethers.Contract;
  private randomEvents: ethers.Contract;
  private agentTrading: ethers.Contract;

  onModuleInit() {
    const config = getEnvConfig();
    this.provider = new ethers.JsonRpcProvider(config.FLOW_EVM_RPC);
    this.signer = new ethers.Wallet(config.DEPLOY_WALLET_KEY, this.provider);

    this.depositToken = new ethers.Contract(
      config.DEPOSIT_TOKEN_ADDRESS,
      DEPOSIT_TOKEN_ABI,
      this.provider,
    );

    this.neonNexus = new ethers.Contract(
      config.NEON_NEXUS_ADDRESS,
      NEON_NEXUS_ABI,
      this.provider,
    );

    this.randomEvents = new ethers.Contract(
      config.RANDOM_EVENTS_ADDRESS,
      RANDOM_EVENTS_ABI,
      this.provider,
    );

    this.agentTrading = new ethers.Contract(
      config.AGENT_TRADING_ADDRESS,
      AGENT_TRADING_ABI,
      this.provider,
    );
  }

  getProvider(): ethers.JsonRpcProvider {
    return this.provider;
  }

  // Send a tx with managed nonce — fires immediately, waits for confirmation
  private async sendManagedTx(txParams: { to: string; data?: string; value?: bigint }): Promise<{ hash: string }> {
    const prevLock = this.nonceLock;
    let resolve: () => void;
    this.nonceLock = new Promise<void>((r) => { resolve = r; });
    await prevLock;

    try {
      if (this.managedNonce < 0) {
        this.managedNonce = await this.signer.getNonce();
      }
      const tx = await this.signer.sendTransaction({ ...txParams, nonce: this.managedNonce });
      this.managedNonce++;
      resolve!();
      await tx.wait();
      return { hash: tx.hash };
    } catch (err) {
      this.managedNonce = -1;
      resolve!();
      throw err;
    }
  }

  // Fire a tx without waiting for confirmation — returns immediately after send
  // Uses fixed gasLimit to skip estimateGas (which fails on dependent txs)
  private async fireTransaction(txParams: { to: string; data?: string; value?: bigint }): Promise<ethers.TransactionResponse> {
    const prevLock = this.nonceLock;
    let resolve: () => void;
    this.nonceLock = new Promise<void>((r) => { resolve = r; });
    await prevLock;

    try {
      if (this.managedNonce < 0) {
        this.managedNonce = await this.signer.getNonce();
      }
      const tx = await this.signer.sendTransaction({
        ...txParams,
        nonce: this.managedNonce,
        gasLimit: 300_000n, // skip estimateGas for batch speed
      });
      this.managedNonce++;
      resolve!();
      return tx;
    } catch (err) {
      this.managedNonce = -1;
      resolve!();
      throw err;
    }
  }

  // Send a transaction as the contract owner (deploy wallet) — waits for confirmation
  async ownerSendTransaction(to: string, data: string): Promise<{ hash: string }> {
    return this.sendManagedTx({ to, data });
  }

  // Fire multiple txs in parallel, wait for all confirmations at the end
  async ownerSendBatch(txs: Array<{ to: string; data: string }>): Promise<string[]> {
    const pending: ethers.TransactionResponse[] = [];
    for (const tx of txs) {
      pending.push(await this.fireTransaction({ to: tx.to, data: tx.data }));
    }
    const hashes: string[] = [];
    for (const tx of pending) {
      await tx.wait();
      hashes.push(tx.hash);
    }
    return hashes;
  }

  // Fund an agent wallet with native FLOW from the deploy wallet
  async fundWallet(toAddress: string, amountInEther: string): Promise<{ hash: string }> {
    return this.sendManagedTx({
      to: toAddress,
      value: ethers.parseEther(amountInEther),
    });
  }

  // Get native FLOW balance of an address
  async getBalance(address: string): Promise<string> {
    const balance = await this.provider.getBalance(address);
    return ethers.formatEther(balance);
  }

  // NeonNexus encode methods
  encodeRegisterAgent(player: string, agentWallet: string): string {
    return this.neonNexus.interface.encodeFunctionData('registerAgent', [player, agentWallet]);
  }

  encodeDeposit(agentWallet: string, amount: bigint): string {
    return this.neonNexus.interface.encodeFunctionData('deposit', [agentWallet, amount]);
  }

  encodeDistributeYield(agentWallet: string, yieldAmount: bigint): string {
    return this.neonNexus.interface.encodeFunctionData('distributeYield', [agentWallet, yieldAmount]);
  }

  encodeSetStrategy(agentWallet: string, strategyType: number): string {
    return this.neonNexus.interface.encodeFunctionData('setStrategy', [agentWallet, strategyType]);
  }

  encodeDeactivateAgent(agentWallet: string): string {
    return this.neonNexus.interface.encodeFunctionData('deactivateAgent', [agentWallet]);
  }

  encodeTransferYield(from: string, to: string, amount: bigint): string {
    return this.neonNexus.interface.encodeFunctionData('transferYield', [from, to, amount]);
  }

  // RandomEvents encode methods
  encodeCommitEvent(agent: string, eventType: number): string {
    return this.randomEvents.interface.encodeFunctionData('commitEvent', [agent, eventType]);
  }

  encodeRevealEvent(agent: string): string {
    return this.randomEvents.interface.encodeFunctionData('revealEvent', [agent]);
  }

  // AgentTrading encode methods
  encodeCreateOffer(seller: string, resourceType: number, quantity: bigint, pricePerUnit: bigint): string {
    return this.agentTrading.interface.encodeFunctionData('createOffer', [seller, resourceType, quantity, pricePerUnit]);
  }

  encodeExecuteTrade(buyer: string, offerId: bigint, quantity: bigint): string {
    return this.agentTrading.interface.encodeFunctionData('executeTrade', [buyer, offerId, quantity]);
  }

  encodeMintResources(agent: string, resourceType: number, quantity: bigint): string {
    return this.agentTrading.interface.encodeFunctionData('mintResources', [agent, resourceType, quantity]);
  }

  encodeBurnResources(agent: string, resourceType: number, amount: bigint): string {
    return this.agentTrading.interface.encodeFunctionData('burnResources', [agent, resourceType, amount]);
  }

  // Read methods
  async getAgent(agentWallet: string): Promise<any> {
    const raw = await this.neonNexus.getAgent(agentWallet);
    return {
      wallet: raw.wallet,
      deposit: raw.deposit.toString(),
      yieldEarned: raw.yieldEarned.toString(),
      lastHarvest: raw.lastHarvest.toString(),
      strategyType: Number(raw.strategyType),
      active: raw.active,
    };
  }

  async getAgentResources(agent: string, resourceType: number): Promise<bigint> {
    const val = await this.agentTrading.agentResources(agent, resourceType);
    return BigInt(val);
  }

  async getAgentResourcesAsString(agent: string, resourceType: number): Promise<string> {
    const val = await this.agentTrading.agentResources(agent, resourceType);
    return val.toString();
  }

  async getOffer(offerId: number): Promise<any> {
    return this.agentTrading.offers(offerId);
  }

  async getNextOfferId(): Promise<bigint> {
    const val = await this.agentTrading.nextOfferId();
    return BigInt(val);
  }

  // DepositToken encode methods
  encodeMintToken(to: string, amount: bigint): string {
    return this.depositToken.interface.encodeFunctionData('mint', [to, amount]);
  }

  encodeApproveToken(spender: string, amount: bigint): string {
    return this.depositToken.interface.encodeFunctionData('approve', [spender, amount]);
  }

  async getTokenBalance(address: string): Promise<bigint> {
    const val = await this.depositToken.balanceOf(address);
    return BigInt(val);
  }

  getDepositTokenAddress(): string {
    return getEnvConfig().DEPOSIT_TOKEN_ADDRESS;
  }

  getNeonNexusAddress(): string {
    return getEnvConfig().NEON_NEXUS_ADDRESS;
  }

  getRandomEventsAddress(): string {
    return getEnvConfig().RANDOM_EVENTS_ADDRESS;
  }

  getAgentTradingAddress(): string {
    return getEnvConfig().AGENT_TRADING_ADDRESS;
  }
}
