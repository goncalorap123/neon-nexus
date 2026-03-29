import { Injectable, OnModuleInit } from '@nestjs/common';
import { ethers } from 'ethers';
import { getEnvConfig } from '../config/env.config';

// Minimal ABI placeholders - replace with full ABIs after contract compilation
const NEON_NEXUS_ABI = [
  'function registerAgent(address agent) external',
  'function deposit(address agent, uint256 amount) external',
  'function distributeYield(address[] calldata agents, uint256[] calldata amounts) external',
  'function setStrategy(address agent, uint8 strategy) external',
  'function getAgent(address agent) external view returns (tuple(address wallet, uint256 balance, uint8 strategy, bool active))',
  'function mintResources(address agent, uint256 amount) external',
];

const RANDOM_EVENTS_ABI = [
  'function commitEvent(bytes32 commitment) external',
  'function revealEvent(uint256 secret) external returns (uint256 eventType)',
];

const AGENT_TRADING_ABI = [
  'function createOffer(uint256 resourceType, uint256 amount, uint256 price) external returns (uint256 offerId)',
  'function executeTrade(uint256 offerId) external',
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

  encodeRegisterAgent(agentAddress: string): string {
    return this.neonNexus.interface.encodeFunctionData('registerAgent', [agentAddress]);
  }

  encodeDeposit(agentAddress: string, amount: bigint): string {
    return this.neonNexus.interface.encodeFunctionData('deposit', [agentAddress, amount]);
  }

  encodeDistributeYield(agents: string[], amounts: bigint[]): string {
    return this.neonNexus.interface.encodeFunctionData('distributeYield', [agents, amounts]);
  }

  encodeSetStrategy(agentAddress: string, strategy: number): string {
    return this.neonNexus.interface.encodeFunctionData('setStrategy', [agentAddress, strategy]);
  }

  encodeMintResources(agentAddress: string, amount: bigint): string {
    return this.neonNexus.interface.encodeFunctionData('mintResources', [agentAddress, amount]);
  }

  encodeCommitEvent(commitment: string): string {
    return this.randomEvents.interface.encodeFunctionData('commitEvent', [commitment]);
  }

  encodeRevealEvent(secret: bigint): string {
    return this.randomEvents.interface.encodeFunctionData('revealEvent', [secret]);
  }

  encodeCreateOffer(resourceType: bigint, amount: bigint, price: bigint): string {
    return this.agentTrading.interface.encodeFunctionData('createOffer', [
      resourceType,
      amount,
      price,
    ]);
  }

  encodeExecuteTrade(offerId: bigint): string {
    return this.agentTrading.interface.encodeFunctionData('executeTrade', [offerId]);
  }

  async getAgent(agentAddress: string): Promise<any> {
    return this.neonNexus.getAgent(agentAddress);
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
