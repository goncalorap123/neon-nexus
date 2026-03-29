import { Injectable, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { getEnvConfig } from '../config/env.config';

const NEON_NEXUS_ABI = [
  'function registerAgent(address player, address agentWallet) external',
  'function deposit(address agentWallet, uint256 amount) external',
  'function withdraw(address agentWallet, uint256 amount) external',
  'function distributeYield(address agentWallet, uint256 yieldAmount) external',
  'function setStrategy(address agentWallet, uint8 strategyType) external',
  'function getAgent(address agentWallet) external view returns (tuple(address wallet, uint256 deposit, uint256 yieldEarned, uint256 lastHarvest, uint8 strategyType, bool active))',
  'function totalDeposits() external view returns (uint256)',
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
  'function agentResources(address agent, uint8 resourceType) external view returns (uint256)',
  'function offers(uint256 offerId) external view returns (address seller, uint8 resourceType, uint256 quantity, uint256 pricePerUnit, bool active)',
  'function nextOfferId() external view returns (uint256)',
];

@Injectable()
export class BlockchainService implements OnModuleInit {
  private provider: ethers.JsonRpcProvider;
  private neonNexus: ethers.Contract;
  private randomEvents: ethers.Contract;
  private agentTrading: ethers.Contract;

  onModuleInit() {
    const config = getEnvConfig();
    this.provider = new ethers.JsonRpcProvider(config.FLOW_EVM_RPC);

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

  // Send a transaction as the contract owner (deploy wallet)
  async ownerSendTransaction(to: string, data: string): Promise<{ hash: string }> {
    const config = getEnvConfig();
    const signer = new ethers.Wallet(config.DEPLOY_WALLET_KEY, this.provider);
    const tx = await signer.sendTransaction({ to, data });
    await tx.wait();
    return { hash: tx.hash };
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
