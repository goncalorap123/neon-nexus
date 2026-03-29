import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const NeonNexusModule = buildModule('NeonNexusModule', (m) => {
  // Deploy mock stablecoin (PYUSD stand-in) for testnet
  const mockToken = m.contract('MockERC20', ['Mock PYUSD', 'mPYUSD', 6]);

  const neonNexus = m.contract('NeonNexus', [mockToken]);
  const randomEvents = m.contract('RandomEvents');
  const agentTrading = m.contract('AgentTrading');

  return { mockToken, neonNexus, randomEvents, agentTrading };
});

export default NeonNexusModule;
