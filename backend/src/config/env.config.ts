import * as dotenv from 'dotenv';
import * as path from 'path';

// Try multiple possible .env locations
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });
dotenv.config({ path: path.resolve(process.cwd(), '.env') });
dotenv.config({ path: path.resolve(process.cwd(), '../.env') });

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
  DEPLOY_WALLET_KEY: string;
  OPERATOR_KEYS: string[];
  GROQ_API_KEY: string;
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
    DEPLOY_WALLET_KEY: process.env.DEPLOY_WALLET_KEY || '',
    OPERATOR_KEYS: (process.env.OPERATOR_KEYS || '').split(',').filter(k => k.length > 0),
    GROQ_API_KEY: process.env.GROQ_API_KEY || '',
  };
}
