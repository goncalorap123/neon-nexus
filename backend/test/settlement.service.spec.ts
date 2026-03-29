import { Test, TestingModule } from '@nestjs/testing';
import { SettlementService } from '../src/settlement/settlement.service';
import { AgentService } from '../src/agent/agent.service';
import { BlockchainService } from '../src/blockchain/blockchain.service';
import { PrivyService } from '../src/privy/privy.service';

describe('SettlementService', () => {
  let service: SettlementService;
  let mockAgentService: any;
  let mockBlockchain: any;
  let mockPrivy: any;

  beforeEach(async () => {
    mockAgentService = {
      getAllAgents: jest.fn().mockResolvedValue([]),
    };

    mockBlockchain = {
      getAgent: jest.fn().mockResolvedValue({
        deposit: 1000000n,
        yieldEarned: 500n,
        strategyType: 1,
        active: true,
      }),
      encodeDistributeYield: jest.fn().mockReturnValue('0xYIELD'),
      encodeMintResources: jest.fn().mockReturnValue('0xMINT'),
      encodeCreateOffer: jest.fn().mockReturnValue('0xOFFER'),
      getNeonNexusAddress: jest.fn().mockReturnValue('0xNEON'),
      getAgentTradingAddress: jest.fn().mockReturnValue('0xTRADE'),
      getAgentResources: jest.fn().mockResolvedValue(50n),
    };

    mockPrivy = {
      sendTransaction: jest.fn().mockResolvedValue({ hash: '0xTX' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        { provide: AgentService, useValue: mockAgentService },
        { provide: BlockchainService, useValue: mockBlockchain },
        { provide: PrivyService, useValue: mockPrivy },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('distributeYield', () => {
    it('should skip when no agents exist', async () => {
      await service.distributeYield();
      expect(mockBlockchain.getAgent).not.toHaveBeenCalled();
    });

    it('should distribute yield to active agents with deposits', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA1', walletId: 'w1' },
      ]);

      await service.distributeYield();

      expect(mockBlockchain.getAgent).toHaveBeenCalledWith('0xA1');
      expect(mockBlockchain.encodeDistributeYield).toHaveBeenCalled();
      expect(mockPrivy.sendTransaction).toHaveBeenCalled();
    });

    it('should skip agents with zero deposits', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA1', walletId: 'w1' },
      ]);
      mockBlockchain.getAgent.mockResolvedValue({
        deposit: 0n,
        strategyType: 1,
        active: true,
      });

      await service.distributeYield();

      expect(mockBlockchain.encodeDistributeYield).not.toHaveBeenCalled();
    });
  });

  describe('runAgentDecisions', () => {
    it('should skip when no agents exist', async () => {
      await service.runAgentDecisions();
      expect(mockBlockchain.getAgent).not.toHaveBeenCalled();
    });

    it('should mint resources for agents with yield', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA1', walletId: 'w1' },
      ]);

      await service.runAgentDecisions();

      expect(mockBlockchain.encodeMintResources).toHaveBeenCalled();
      expect(mockPrivy.sendTransaction).toHaveBeenCalled();
    });

    it('should skip agents with zero yield', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA1', walletId: 'w1' },
      ]);
      mockBlockchain.getAgent.mockResolvedValue({
        deposit: 1000n,
        yieldEarned: 0n,
        strategyType: 0,
        active: true,
      });

      await service.runAgentDecisions();

      expect(mockBlockchain.encodeMintResources).not.toHaveBeenCalled();
    });
  });
});
