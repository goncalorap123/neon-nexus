import { Test, TestingModule } from '@nestjs/testing';
import { SettlementService } from '../src/settlement/settlement.service';
import { AgentService } from '../src/agent/agent.service';
import { BlockchainService } from '../src/blockchain/blockchain.service';
import { TransactionLogService } from '../src/database/transaction-log.service';

describe('SettlementService', () => {
  let service: SettlementService;

  const mockAgentService = {
    getAllAgents: jest.fn(),
  };

  const mockBlockchainService = {
    getAgent: jest.fn(),
    encodeDistributeYield: jest.fn().mockReturnValue('0xYIELD'),
    encodeMintResources: jest.fn().mockReturnValue('0xMINT'),
    encodeCreateOffer: jest.fn().mockReturnValue('0xOFFER'),
    ownerSendTransaction: jest.fn().mockResolvedValue({ hash: '0xTX' }),
    getNeonNexusAddress: jest.fn().mockReturnValue('0xNEON'),
    getAgentTradingAddress: jest.fn().mockReturnValue('0xTRADE'),
    getAgentResources: jest.fn(),
  };

  const mockTxLogService = {
    log: jest.fn().mockResolvedValue({ id: 1 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        { provide: AgentService, useValue: mockAgentService },
        { provide: BlockchainService, useValue: mockBlockchainService },
        { provide: TransactionLogService, useValue: mockTxLogService },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
    jest.clearAllMocks();
  });

  describe('distributeYield', () => {
    it('should do nothing when no active agents', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([]);
      await service.distributeYield();
      expect(mockBlockchainService.ownerSendTransaction).not.toHaveBeenCalled();
    });

    it('should skip agents with zero deposit', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockBlockchainService.getAgent.mockResolvedValue({
        active: true,
        deposit: '0',
        strategyType: 1,
      });

      await service.distributeYield();

      expect(mockBlockchainService.encodeDistributeYield).not.toHaveBeenCalled();
      expect(mockBlockchainService.ownerSendTransaction).not.toHaveBeenCalled();
    });

    it('should skip inactive on-chain agents', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockBlockchainService.getAgent.mockResolvedValue({
        active: false,
        deposit: '1000',
        strategyType: 0,
      });

      await service.distributeYield();

      expect(mockBlockchainService.encodeDistributeYield).not.toHaveBeenCalled();
    });

    it('should calculate yield correctly for conservative strategy (rate=50)', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockBlockchainService.getAgent.mockResolvedValue({
        active: true,
        deposit: '1000000',
        strategyType: 0,
      });

      await service.distributeYield();

      // yieldAmount = (1_000_000 * 50) / 1_000_000 = 50
      expect(mockBlockchainService.encodeDistributeYield).toHaveBeenCalledWith('0xA', 50n);
      expect(mockBlockchainService.ownerSendTransaction).toHaveBeenCalledWith('0xNEON', '0xYIELD');
      expect(mockTxLogService.log).toHaveBeenCalledWith(
        'p1', '0xA', 'yield_distributed', '',
        { yieldAmount: '50', strategyType: 0 },
      );
    });

    it('should calculate yield correctly for aggressive strategy (rate=200)', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockBlockchainService.getAgent.mockResolvedValue({
        active: true,
        deposit: '2000000',
        strategyType: 2,
      });

      await service.distributeYield();

      // yieldAmount = (2_000_000 * 200) / 1_000_000 = 400
      expect(mockBlockchainService.encodeDistributeYield).toHaveBeenCalledWith('0xA', 400n);
    });

    it('should process multiple agents', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
        { playerId: 'p2', address: '0xB' },
      ]);
      mockBlockchainService.getAgent.mockResolvedValue({
        active: true,
        deposit: '1000000',
        strategyType: 1,
      });

      await service.distributeYield();

      expect(mockBlockchainService.ownerSendTransaction).toHaveBeenCalledTimes(2);
      expect(mockTxLogService.log).toHaveBeenCalledTimes(2);
    });
  });

  describe('runAgentDecisions', () => {
    it('should do nothing when no active agents', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([]);
      await service.runAgentDecisions();
      expect(mockBlockchainService.encodeMintResources).not.toHaveBeenCalled();
    });

    it('should skip agents with zero yieldEarned', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockBlockchainService.getAgent.mockResolvedValue({
        active: true,
        strategyType: 1,
        yieldEarned: '0',
      });

      await service.runAgentDecisions();

      expect(mockBlockchainService.encodeMintResources).not.toHaveBeenCalled();
    });

    it('should mint resources per strategy weights for balanced (strategy 1)', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockBlockchainService.getAgent.mockResolvedValue({
        active: true,
        strategyType: 1,
        yieldEarned: '10000',
      });
      // No surplus resources
      mockBlockchainService.getAgentResources.mockResolvedValue(50n);

      await service.runAgentDecisions();

      // totalWeight = 25+35+25+15 = 100
      // wood:   (10000 * 25) / (100 * 100) = 25
      // steel:  (10000 * 35) / (100 * 100) = 35
      // energy: (10000 * 25) / (100 * 100) = 25
      // food:   (10000 * 15) / (100 * 100) = 15
      expect(mockBlockchainService.encodeMintResources).toHaveBeenCalledWith('0xA', 0, 25n);
      expect(mockBlockchainService.encodeMintResources).toHaveBeenCalledWith('0xA', 1, 35n);
      expect(mockBlockchainService.encodeMintResources).toHaveBeenCalledWith('0xA', 2, 25n);
      expect(mockBlockchainService.encodeMintResources).toHaveBeenCalledWith('0xA', 3, 15n);

      expect(mockTxLogService.log).toHaveBeenCalledWith(
        'p1', '0xA', 'resources_minted', '',
        expect.objectContaining({ strategyType: 1 }),
      );
    });

    it('should auto-list surplus resources (>200)', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockBlockchainService.getAgent.mockResolvedValue({
        active: true,
        strategyType: 0,
        yieldEarned: '10000',
      });
      // Resource 0 (wood) has surplus of 300, others are low
      mockBlockchainService.getAgentResources
        .mockResolvedValueOnce(300n)  // wood - surplus
        .mockResolvedValueOnce(50n)   // steel
        .mockResolvedValueOnce(10n)   // energy
        .mockResolvedValueOnce(100n); // food

      await service.runAgentDecisions();

      // Should create offer: sell 300-100=200 wood at price 1
      expect(mockBlockchainService.encodeCreateOffer).toHaveBeenCalledWith('0xA', 0, 200n, 1n);
      expect(mockTxLogService.log).toHaveBeenCalledWith(
        'p1', '0xA', 'auto_trade', '',
        expect.objectContaining({ resource: 'wood', amount: '200' }),
      );
    });

    it('should not auto-list when resources are not surplus', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockBlockchainService.getAgent.mockResolvedValue({
        active: true,
        strategyType: 0,
        yieldEarned: '10000',
      });
      mockBlockchainService.getAgentResources.mockResolvedValue(100n);

      await service.runAgentDecisions();

      expect(mockBlockchainService.encodeCreateOffer).not.toHaveBeenCalled();
    });

    it('should call autoTrade for aggressive strategy (strategy 2)', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockBlockchainService.getAgent.mockResolvedValue({
        active: true,
        strategyType: 2,
        yieldEarned: '10000',
      });
      // Surplus check returns low values
      mockBlockchainService.getAgentResources
        .mockResolvedValueOnce(50n)  // wood (surplus check)
        .mockResolvedValueOnce(50n)  // steel (surplus check)
        .mockResolvedValueOnce(50n)  // energy (surplus check)
        .mockResolvedValueOnce(50n)  // food (surplus check)
        .mockResolvedValueOnce(200n); // energy for autoTrade (>100, so sell half=100)

      await service.runAgentDecisions();

      // autoTrade should encode createOffer for energy (resource type 2)
      expect(mockBlockchainService.encodeCreateOffer).toHaveBeenCalledWith('0xA', 2, 100n, 1n);
    });

    it('should not autoTrade when energy <= 100', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockBlockchainService.getAgent.mockResolvedValue({
        active: true,
        strategyType: 2,
        yieldEarned: '10000',
      });
      // All resources low, including energy for autoTrade
      mockBlockchainService.getAgentResources.mockResolvedValue(50n);

      await service.runAgentDecisions();

      // encodeCreateOffer should NOT be called (no surplus, energy <= 100)
      expect(mockBlockchainService.encodeCreateOffer).not.toHaveBeenCalled();
    });
  });
});
