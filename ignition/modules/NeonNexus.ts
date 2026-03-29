import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

const NeonNexusModule = buildModule('NeonNexusModule', (m) => {
  const depositToken = m.getParameter(
    'depositToken',
    '0x0000000000000000000000000000000000000000',
  );

  const neonNexus = m.contract('NeonNexus', [depositToken]);
  const randomEvents = m.contract('RandomEvents');
  const agentTrading = m.contract('AgentTrading');

  return { neonNexus, randomEvents, agentTrading };
});

export default NeonNexusModule;
