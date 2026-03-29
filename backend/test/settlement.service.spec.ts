import { Test, TestingModule } from '@nestjs/testing';
import { SettlementService } from '../src/settlement/settlement.service';
import { AgentService } from '../src/agent/agent.service';
import { BlockchainService } from '../src/blockchain/blockchain.service';
import { TransactionLogService } from '../src/database/transaction-log.service';
import { AiReasoningService } from '../src/ai/ai-reasoning.service';
import { AgentActionService } from '../src/database/agent-action.service';

describe('SettlementService', () => {
  let service: SettlementService;

  const mockAgentService = {
    getAllAgents: jest.fn(),
    updateStrategy: jest.fn(),
  };

  const mockBlockchainService = {
    getAgent: jest.fn(),
    encodeDistributeYield: jest.fn().mockReturnValue('0xYIELD'),
    encodeMintResources: jest.fn().mockReturnValue('0xMINT'),
    encodeCreateOffer: jest.fn().mockReturnValue('0xOFFER'),
    encodeExecuteTrade: jest.fn().mockReturnValue('0xTRADE'),
    encodeSetStrategy: jest.fn().mockReturnValue('0xSTRAT'),
    encodeCommitEvent: jest.fn().mockReturnValue('0xCOMMIT'),
    encodeRevealEvent: jest.fn().mockReturnValue('0xREVEAL'),
    ownerSendTransaction: jest.fn().mockResolvedValue({ hash: '0xTX' }),
    getNeonNexusAddress: jest.fn().mockReturnValue('0xNEON'),
    getAgentTradingAddress: jest.fn().mockReturnValue('0xTRADE'),
    getRandomEventsAddress: jest.fn().mockReturnValue('0xRANDOM'),
    getAgentResources: jest.fn().mockResolvedValue(50n),
    getBalance: jest.fn().mockResolvedValue('10.0'),
    getNextOfferId: jest.fn().mockResolvedValue(0n),
    getOffer: jest.fn(),
  };

  const mockTxLogService = {
    log: jest.fn().mockResolvedValue({ id: 1 }),
    getRecentLogs: jest.fn().mockResolvedValue([]),
  };

  const mockAiReasoningService = {
    decideAgentAction: jest.fn(),
  };

  const mockAgentActionService = {
    updateAction: jest.fn().mockResolvedValue({ playerId: 'p1', currentAction: 'idle' }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SettlementService,
        { provide: AgentService, useValue: mockAgentService },
        { provide: BlockchainService, useValue: mockBlockchainService },
        { provide: TransactionLogService, useValue: mockTxLogService },
        { provide: AiReasoningService, useValue: mockAiReasoningService },
        { provide: AgentActionService, useValue: mockAgentActionService },
      ],
    }).compile();

    service = module.get<SettlementService>(SettlementService);
    jest.clearAllMocks();
    // Reset default mocks
    mockBlockchainService.getAgentResources.mockResolvedValue(50n);
    mockBlockchainService.getBalance.mockResolvedValue('10.0');
    mockBlockchainService.getNextOfferId.mockResolvedValue(0n);
    mockTxLogService.getRecentLogs.mockResolvedValue([]);
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
    const defaultOnChain = {
      active: true,
      strategyType: 1,
      deposit: '1000',
      yieldEarned: '500',
    };

    beforeEach(() => {
      mockBlockchainService.getAgent.mockResolvedValue(defaultOnChain);
    });

    it('should do nothing when no active agents', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([]);
      await service.runAgentDecisions();
      expect(mockAiReasoningService.decideAgentAction).not.toHaveBeenCalled();
    });

    it('should call AI reasoning service for each agent', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockAiReasoningService.decideAgentAction.mockResolvedValue({
        action: 'idle',
        details: {},
        reasoning: 'Nothing to do right now',
      });

      await service.runAgentDecisions();

      expect(mockAiReasoningService.decideAgentAction).toHaveBeenCalledWith(
        expect.objectContaining({
          agentId: 'p1',
          strategy: 'Balanced',
          strategyType: 1,
        }),
      );
    });

    it('should execute gather action and mint resources', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockAiReasoningService.decideAgentAction.mockResolvedValue({
        action: 'gather',
        details: { resourceToGather: 2 },
        reasoning: 'Gathering energy for score boost',
      });

      await service.runAgentDecisions();

      expect(mockBlockchainService.encodeMintResources).toHaveBeenCalled();
      expect(mockBlockchainService.ownerSendTransaction).toHaveBeenCalled();
      expect(mockTxLogService.log).toHaveBeenCalledWith(
        'p1', '0xA', 'resources_gathered', '',
        expect.objectContaining({ resourceName: 'energy', reasoning: 'Gathering energy for score boost' }),
      );
    });

    it('should execute trade create_offer action', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockAiReasoningService.decideAgentAction.mockResolvedValue({
        action: 'trade',
        details: {
          tradeAction: 'create_offer',
          tradeResourceType: 1,
          tradeQuantity: 50,
          tradePricePerUnit: 2,
        },
        reasoning: 'Selling surplus steel',
      });

      await service.runAgentDecisions();

      expect(mockBlockchainService.encodeCreateOffer).toHaveBeenCalledWith('0xA', 1, 50n, 2n);
      expect(mockTxLogService.log).toHaveBeenCalledWith(
        'p1', '0xA', 'trade_create_offer', '',
        expect.objectContaining({ resourceName: 'steel', reasoning: 'Selling surplus steel' }),
      );
    });

    it('should execute trade accept_offer action', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockAiReasoningService.decideAgentAction.mockResolvedValue({
        action: 'trade',
        details: {
          tradeAction: 'accept_offer',
          tradeOfferId: 3,
          tradeQuantity: 10,
        },
        reasoning: 'Buying cheap wood',
      });

      await service.runAgentDecisions();

      expect(mockBlockchainService.encodeExecuteTrade).toHaveBeenCalledWith('0xA', 3n, 10n);
      expect(mockTxLogService.log).toHaveBeenCalledWith(
        'p1', '0xA', 'trade_accept_offer', '',
        expect.objectContaining({ reasoning: 'Buying cheap wood' }),
      );
    });

    it('should execute change_strategy action', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockAiReasoningService.decideAgentAction.mockResolvedValue({
        action: 'change_strategy',
        details: { newStrategy: 2 },
        reasoning: 'Switching to aggressive for higher yield',
      });

      await service.runAgentDecisions();

      expect(mockBlockchainService.encodeSetStrategy).toHaveBeenCalledWith('0xA', 2);
      expect(mockAgentService.updateStrategy).toHaveBeenCalledWith('p1', 2);
    });

    it('should execute idle action and log it', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockAiReasoningService.decideAgentAction.mockResolvedValue({
        action: 'idle',
        details: {},
        reasoning: 'Market conditions unfavorable, holding position',
      });

      await service.runAgentDecisions();

      expect(mockTxLogService.log).toHaveBeenCalledWith(
        'p1', '0xA', 'idle', '',
        expect.objectContaining({ reasoning: 'Market conditions unfavorable, holding position' }),
      );
    });

    it('should update agent action tracking after decision', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockAiReasoningService.decideAgentAction.mockResolvedValue({
        action: 'gather',
        details: { resourceToGather: 0 },
        reasoning: 'Need more wood',
      });

      await service.runAgentDecisions();

      expect(mockAgentActionService.updateAction).toHaveBeenCalledWith(
        'p1', 'gather', 'Need more wood', undefined, 0,
      );
    });

    it('should skip inactive on-chain agents in decisions', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
      ]);
      mockBlockchainService.getAgent.mockResolvedValue({
        active: false,
        strategyType: 1,
        deposit: '0',
        yieldEarned: '0',
      });

      await service.runAgentDecisions();

      expect(mockAiReasoningService.decideAgentAction).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully for individual agents', async () => {
      mockAgentService.getAllAgents.mockResolvedValue([
        { playerId: 'p1', address: '0xA' },
        { playerId: 'p2', address: '0xB' },
      ]);
      // The method calls getAgent in two loops: leaderboard build + decision
      // Leaderboard loop: both succeed
      // Decision loop: first agent throws, second succeeds
      let callCount = 0;
      mockBlockchainService.getAgent.mockImplementation(() => {
        callCount++;
        // Calls 1,2 = leaderboard loop (both succeed)
        // Call 3 = decision loop for p1 (throws)
        // Call 4 = decision loop for p2 (succeeds)
        if (callCount === 3) {
          return Promise.reject(new Error('RPC error'));
        }
        return Promise.resolve(defaultOnChain);
      });
      mockAiReasoningService.decideAgentAction.mockResolvedValue({
        action: 'idle',
        details: {},
        reasoning: 'Resting',
      });

      await service.runAgentDecisions();

      // First agent errored, second processed fine
      expect(mockAiReasoningService.decideAgentAction).toHaveBeenCalledTimes(1);
    });
  });
});
