import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgentService } from '../src/agent/agent.service';
import { AgentEntity } from '../src/database/entities/agent.entity';
import { PrivyService } from '../src/privy/privy.service';
import { BlockchainService } from '../src/blockchain/blockchain.service';
import { TransactionLogService } from '../src/database/transaction-log.service';

describe('AgentService', () => {
  let service: AgentService;

  const mockAgentRepo = {
    findOneBy: jest.fn(),
    find: jest.fn(),
    count: jest.fn(),
    create: jest.fn((d) => d),
    save: jest.fn((d) => d),
  };

  const mockPrivyService = {
    createWallet: jest.fn(),
  };

  const mockBlockchainService = {
    encodeRegisterAgent: jest.fn().mockReturnValue('0xDATA'),
    encodeDeposit: jest.fn().mockReturnValue('0xDATA'),
    encodeSetStrategy: jest.fn().mockReturnValue('0xDATA'),
    encodeMintResources: jest.fn().mockReturnValue('0xMINT'),
    ownerSendTransaction: jest.fn().mockResolvedValue({ hash: '0xTX' }),
    fundWallet: jest.fn().mockResolvedValue({ hash: '0xFUND' }),
    getNeonNexusAddress: jest.fn().mockReturnValue('0xNEON'),
    getAgentTradingAddress: jest.fn().mockReturnValue('0xTRADE'),
    getAgent: jest.fn(),
    getBalance: jest.fn(),
  };

  const mockTxLogService = {
    log: jest.fn().mockResolvedValue({ id: 1 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: getRepositoryToken(AgentEntity), useValue: mockAgentRepo },
        { provide: PrivyService, useValue: mockPrivyService },
        { provide: BlockchainService, useValue: mockBlockchainService },
        { provide: TransactionLogService, useValue: mockTxLogService },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
    jest.clearAllMocks();
  });

  describe('createAgent', () => {
    it('should return existing agent without creating a new one', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue({
        playerId: 'player1',
        walletId: 'existing-wallet',
        address: '0xEXIST',
      });

      const result = await service.createAgent('player1');

      expect(result).toEqual({
        walletId: 'existing-wallet',
        address: '0xEXIST',
        txHash: '',
      });
      expect(mockPrivyService.createWallet).not.toHaveBeenCalled();
    });

    it('should create a new agent with wallet, register on-chain, fund, and log', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue(null);
      mockPrivyService.createWallet.mockResolvedValue({
        id: 'wallet-123',
        address: '0xABC',
      });

      const result = await service.createAgent('player1');

      expect(mockPrivyService.createWallet).toHaveBeenCalled();
      expect(mockBlockchainService.encodeRegisterAgent).toHaveBeenCalledWith('0xABC', '0xABC');
      expect(mockBlockchainService.ownerSendTransaction).toHaveBeenCalledWith('0xNEON', '0xDATA');
      expect(mockBlockchainService.fundWallet).toHaveBeenCalledWith('0xABC', '10');

      // Logs agent_created and wallet_funded
      expect(mockTxLogService.log).toHaveBeenCalledTimes(2);
      expect(mockTxLogService.log).toHaveBeenCalledWith(
        'player1', '0xABC', 'agent_created', '0xTX',
        { walletId: 'wallet-123', address: '0xABC' },
      );
      expect(mockTxLogService.log).toHaveBeenCalledWith(
        'player1', '0xABC', 'wallet_funded', '0xFUND',
        { amount: '10 FLOW' },
      );

      // Saves to DB
      expect(mockAgentRepo.create).toHaveBeenCalledWith({
        playerId: 'player1',
        walletId: 'wallet-123',
        address: '0xABC',
      });
      expect(mockAgentRepo.save).toHaveBeenCalled();

      // Seeds starting resources (4 resource types)
      expect(mockBlockchainService.encodeMintResources).toHaveBeenCalledTimes(4);
      // 1 registerAgent + 4 seedResources = 5 ownerSendTransaction calls
      expect(mockBlockchainService.ownerSendTransaction).toHaveBeenCalledTimes(5);

      expect(result).toEqual({
        walletId: 'wallet-123',
        address: '0xABC',
        txHash: '0xTX',
      });
    });
  });

  describe('getAgent', () => {
    it('should return null when agent not found', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue(null);
      const result = await service.getAgent('unknown');
      expect(result).toBeNull();
    });

    it('should return agent with on-chain state', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue({
        playerId: 'player1',
        walletId: 'wallet-123',
        address: '0xABC',
      });
      mockBlockchainService.getAgent.mockResolvedValue({
        deposit: '1000',
        yieldEarned: '50',
        strategyType: 1,
        active: true,
      });

      const result = await service.getAgent('player1');

      expect(result).toEqual({
        playerId: 'player1',
        walletId: 'wallet-123',
        address: '0xABC',
        onChain: {
          deposit: '1000',
          yieldEarned: '50',
          strategyType: 1,
          active: true,
        },
      });
      expect(mockBlockchainService.getAgent).toHaveBeenCalledWith('0xABC');
    });
  });

  describe('deposit', () => {
    it('should encode and send deposit transaction', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue({
        playerId: 'player1',
        address: '0xABC',
      });

      const result = await service.deposit('player1', 500n);

      expect(mockBlockchainService.encodeDeposit).toHaveBeenCalledWith('0xABC', 500n);
      expect(mockBlockchainService.ownerSendTransaction).toHaveBeenCalledWith('0xNEON', '0xDATA');
      expect(result).toEqual({ txHash: '0xTX' });
    });

    it('should throw when no wallet found', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue(null);
      await expect(service.deposit('unknown', 100n)).rejects.toThrow(
        'No wallet found for player unknown',
      );
    });
  });

  describe('setStrategy', () => {
    it('should set strategy, log, and update DB', async () => {
      const agentEntity = {
        playerId: 'player1',
        address: '0xABC',
        strategyType: 0,
      };
      mockAgentRepo.findOneBy.mockResolvedValue(agentEntity);

      const result = await service.setStrategy('player1', 2);

      expect(mockBlockchainService.encodeSetStrategy).toHaveBeenCalledWith('0xABC', 2);
      expect(mockBlockchainService.ownerSendTransaction).toHaveBeenCalledWith('0xNEON', '0xDATA');
      expect(mockTxLogService.log).toHaveBeenCalledWith(
        'player1', '0xABC', 'strategy_changed', '0xTX',
        { strategy: 2, strategyName: 'Aggressive' },
      );
      expect(agentEntity.strategyType).toBe(2);
      expect(mockAgentRepo.save).toHaveBeenCalledWith(agentEntity);
      expect(result).toEqual({ txHash: '0xTX' });
    });

    it('should throw when no wallet found', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue(null);
      await expect(service.setStrategy('unknown', 1)).rejects.toThrow(
        'No wallet found for player unknown',
      );
    });
  });

  describe('getWalletInfo', () => {
    it('should return wallet info when agent exists', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue({
        walletId: 'wallet-123',
        address: '0xABC',
      });

      const result = await service.getWalletInfo('player1');
      expect(result).toEqual({ walletId: 'wallet-123', address: '0xABC' });
    });

    it('should return null when agent not found', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue(null);
      const result = await service.getWalletInfo('unknown');
      expect(result).toBeNull();
    });
  });

  describe('getFlowBalance', () => {
    it('should return balance from blockchain', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue({ address: '0xABC' });
      mockBlockchainService.getBalance.mockResolvedValue('12.5');

      const result = await service.getFlowBalance('player1');
      expect(result).toBe('12.5');
      expect(mockBlockchainService.getBalance).toHaveBeenCalledWith('0xABC');
    });

    it('should return "0" when agent not found', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue(null);
      const result = await service.getFlowBalance('unknown');
      expect(result).toBe('0');
    });
  });

  describe('getAllAgents', () => {
    it('should return all active agents', async () => {
      const agents = [
        { playerId: 'p1', active: true },
        { playerId: 'p2', active: true },
      ];
      mockAgentRepo.find.mockResolvedValue(agents);

      const result = await service.getAllAgents();
      expect(mockAgentRepo.find).toHaveBeenCalledWith({ where: { active: true } });
      expect(result).toEqual(agents);
    });
  });

  describe('getAllPlayerIds', () => {
    it('should return array of player IDs', async () => {
      mockAgentRepo.find.mockResolvedValue([
        { playerId: 'p1' },
        { playerId: 'p2' },
        { playerId: 'p3' },
      ]);

      const result = await service.getAllPlayerIds();
      expect(result).toEqual(['p1', 'p2', 'p3']);
    });

    it('should return empty array when no agents', async () => {
      mockAgentRepo.find.mockResolvedValue([]);
      const result = await service.getAllPlayerIds();
      expect(result).toEqual([]);
    });
  });

  describe('getAgentEntity', () => {
    it('should return agent entity when found', async () => {
      const entity = { playerId: 'p1', walletId: 'w1', address: '0xA', cyclesSurvived: 5 };
      mockAgentRepo.findOneBy.mockResolvedValue(entity);

      const result = await service.getAgentEntity('p1');
      expect(result).toEqual(entity);
      expect(mockAgentRepo.findOneBy).toHaveBeenCalledWith({ playerId: 'p1' });
    });

    it('should return null when not found', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue(null);
      const result = await service.getAgentEntity('unknown');
      expect(result).toBeNull();
    });
  });

  describe('getAliveAgents', () => {
    it('should return alive non-eliminated agents', async () => {
      const agents = [{ playerId: 'p1', active: true, eliminated: false }];
      mockAgentRepo.find.mockResolvedValue(agents);

      const result = await service.getAliveAgents();
      expect(mockAgentRepo.find).toHaveBeenCalledWith({ where: { active: true, eliminated: false } });
      expect(result).toEqual(agents);
    });
  });

  describe('getAliveCount', () => {
    it('should return count of alive agents', async () => {
      mockAgentRepo.count.mockResolvedValue(3);

      const result = await service.getAliveCount();
      expect(mockAgentRepo.count).toHaveBeenCalledWith({ where: { active: true, eliminated: false } });
      expect(result).toBe(3);
    });
  });

  describe('eliminateAgent', () => {
    it('should mark agent as eliminated', async () => {
      const agent = { playerId: 'p1', active: true, eliminated: false, eliminatedAt: null };
      mockAgentRepo.findOneBy.mockResolvedValue(agent);

      await service.eliminateAgent('p1');

      expect(agent.active).toBe(false);
      expect(agent.eliminated).toBe(true);
      expect(agent.eliminatedAt).toBeInstanceOf(Date);
      expect(mockAgentRepo.save).toHaveBeenCalledWith(agent);
    });

    it('should do nothing when agent not found', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue(null);
      await service.eliminateAgent('unknown');
      expect(mockAgentRepo.save).not.toHaveBeenCalled();
    });
  });

  describe('incrementCyclesSurvived', () => {
    it('should increment cyclesSurvived by 1', async () => {
      const agent = { playerId: 'p1', cyclesSurvived: 5 };
      mockAgentRepo.findOneBy.mockResolvedValue(agent);

      await service.incrementCyclesSurvived('p1');

      expect(agent.cyclesSurvived).toBe(6);
      expect(mockAgentRepo.save).toHaveBeenCalledWith(agent);
    });
  });

  describe('getAllAgentsIncludingEliminated', () => {
    it('should return all agents without filter', async () => {
      const agents = [
        { playerId: 'p1', eliminated: false },
        { playerId: 'p2', eliminated: true },
      ];
      mockAgentRepo.find.mockResolvedValue(agents);

      const result = await service.getAllAgentsIncludingEliminated();
      expect(mockAgentRepo.find).toHaveBeenCalledWith();
      expect(result).toEqual(agents);
    });
  });

  describe('isHouseAgent', () => {
    it('should return true for house agents', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue({ playerId: 'house-1', isHouseAgent: true });
      const result = await service.isHouseAgent('house-1');
      expect(result).toBe(true);
    });

    it('should return false for regular agents', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue({ playerId: 'p1', isHouseAgent: false });
      const result = await service.isHouseAgent('p1');
      expect(result).toBe(false);
    });

    it('should return false when agent not found', async () => {
      mockAgentRepo.findOneBy.mockResolvedValue(null);
      const result = await service.isHouseAgent('unknown');
      expect(result).toBe(false);
    });
  });
});
