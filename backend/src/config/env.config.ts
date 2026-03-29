import * as dotenv from 'dotenv';

dotenv.config();

export interface EnvConfig {
  PRIVY_APP_ID: string;
  PRIVY_APP_SECRET: string;
  PRIVY_AUTHORIZATION_PRIVATE_KEY: string;
  FLOW_EVM_RPC: string;
  FLOW_CHAIN_ID: number;
  NEON_NEXUS_ADDRESS: string;
  RANDOM_EVENTS_ADDRESS: string;
  AGENT_TRADING_ADDRESS: string;
  DEPOSIT_TOKEN_ADDRESS: string;
}

export function getEnvConfig(): EnvConfig {
  return {
    PRIVY_APP_ID: process.env.PRIVY_APP_ID || '',
    PRIVY_APP_SECRET: process.env.PRIVY_APP_SECRET || '',
    PRIVY_AUTHORIZATION_PRIVATE_KEY: process.env.PRIVY_AUTHORIZATION_PRIVATE_KEY || '',
    FLOW_EVM_RPC: process.env.FLOW_EVM_RPC || 'https://testnet.evm.nodes.onflow.org',
    FLOW_CHAIN_ID: parseInt(process.env.FLOW_CHAIN_ID || '545', 10),
    NEON_NEXUS_ADDRESS: process.env.NEON_NEXUS_ADDRESS || '',
    RANDOM_EVENTS_ADDRESS: process.env.RANDOM_EVENTS_ADDRESS || '',
    AGENT_TRADING_ADDRESS: process.env.AGENT_TRADING_ADDRESS || '',
    DEPOSIT_TOKEN_ADDRESS: process.env.DEPOSIT_TOKEN_ADDRESS || '',
  };
}
