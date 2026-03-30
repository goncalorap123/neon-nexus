import { Test, TestingModule } from '@nestjs/testing';
import { GameService } from '../src/game/game.service';
import { AgentService } from '../src/agent/agent.service';
import { RandomService } from '../src/random/random.service';
import { BlockchainService } from '../src/blockchain/blockchain.service';
import { TransactionLogService } from '../src/database/transaction-log.service';

describe('GameService', () => {
  let service: GameService;

  const mockAgentService = {
    getAgent: jest.fn(),
    getAgentEntity: jest.fn(),
    getWalletInfo: jest.fn(),
    getAllPlayerIds: jest.fn(),
    getAliveCount: jest.fn(),
    getAllAgentsIncludingEliminated: jest.fn(),
  };

  const mockRandomService = {
    commitEvent: jest.fn().mockResolvedValue({ txHash: '0xCOMMIT' }),
    revealEvent: jest.fn().mockResolvedValue({ txHash: '0xREVEAL' }),
  };

  const mockBlockchainService = {
    getAgent: jest.fn(),
    getAgentResources: jest.fn(),
    getBalance: jest.fn(),
    encodeMintResources: jest.fn().mockReturnValue('0xDATA'),
    ownerSendTransaction: jest.fn().mockResolvedValue({ hash: '0xTX' }),
    getAgentTradingAddress: jest.fn().mockReturnValue('0xTRADE'),
  };

  const mockTxLogService = {
    log: jest.fn().mockResolvedValue({ id: 1 }),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        GameService,
        { provide: AgentService, useValue: mockAgentService },
        { provide: RandomService, useValue: mockRandomService },
        { provide: BlockchainService, useValue: mockBlockchainService },
        { provide: TransactionLogService, useValue: mockTxLogService },
      ],
    }).compile();

    service = module.get<GameService>(GameService);
    jest.clearAllMocks();
  });

  describe('getGameState', () => {
    it('should return null when agent not found', async () => {
      mockAgentService.getAgent.mockResolvedValue(null);
      const result = await service.getGameState('unknown');
      expect(result).toBeNull();
    });

    it('should return game state with resources and correct score', async () => {
      mockAgentService.getAgent.mockResolvedValue({
        playerId: 'player1',
        address: '0xABC',
        onChain: { deposit: 1000, yieldEarned: 200, strategyType: 1 },
      });
      mockAgentService.getAgentEntity.mockResolvedValue({
        playerId: 'player1',
        cyclesSurvived: 5,
        eliminated: false,
        isHouseAgent: false,
      });
      mockAgentService.getAliveCount.mockResolvedValue(3);
      mockAgentService.getAllAgentsIncludingEliminated.mockResolvedValue([
        { playerId: 'player1' }, { playerId: 'player2' }, { playerId: 'player3' },
      ]);
      mockBlockchainService.getAgentResources
        .mockResolvedValueOnce(10n) // wood
        .mockResolvedValueOnce(5n)  // steel
        .mockResolvedValueOnce(3n)  // energy
        .mockResolvedValueOnce(8n); // food
      mockBlockchainService.getBalance.mockResolvedValue('50.0');

      const result = await service.getGameState('player1');

      expect(result.player.playerId).toBe('player1');
      expect(result.resources).toEqual({
        wood: '10',
        steel: '5',
        energy: '3',
        food: '8',
      });
      expect(result.flowBalance).toBe('50.0');
      // score = 1000 + 200 + (10*10 + 5*15 + 3*20 + 8*10) = 1200 + (100+75+60+80) = 1515
      expect(result.score).toBe(1515);
      // Survival info
      expect(result.survival).toBeDefined();
      expect(result.survival.cyclesSurvived).toBe(5);
      expect(result.aliveCount).toBe(3);
      expect(result.totalAgents).toBe(3);
    });

    it('should default resources to "0" on error', async () => {
      mockAgentService.getAgent.mockResolvedValue({
        playerId: 'player1',
        address: '0xABC',
        onChain: { deposit: 0, yieldEarned: 0, strategyType: 1 },
      });
      mockAgentService.getAgentEntity.mockResolvedValue({
        playerId: 'player1',
        cyclesSurvived: 0,
        eliminated: false,
        isHouseAgent: false,
      });
      mockAgentService.getAliveCount.mockResolvedValue(1);
      mockAgentService.getAllAgentsIncludingEliminated.mockResolvedValue([{ playerId: 'player1' }]);
      mockBlockchainService.getAgentResources.mockRejectedValue(new Error('fail'));
      mockBlockchainService.getBalance.mockRejectedValue(new Error('fail'));

      const result = await service.getGameState('player1');

      expect(result.resources).toEqual({ wood: '0', steel: '0', energy: '0', food: '0' });
      expect(result.flowBalance).toBe('0');
      expect(result.score).toBe(0);
    });
  });

  describe('triggerRandomEvent', () => {
    it('should call randomService.commitEvent with correct args', async () => {
      mockAgentService.getWalletInfo.mockResolvedValue({
        walletId: 'wallet-123',
        address: '0xABC',
      });

      const result = await service.triggerRandomEvent('player1', 0);

      expect(mockRandomService.commitEvent).toHaveBeenCalledWith('wallet-123', '0xABC', 0);
      expect(result).toEqual({ txHash: '0xCOMMIT' });
    });

    it('should throw when no wallet found', async () => {
      mockAgentService.getWalletInfo.mockResolvedValue(null);
      await expect(service.triggerRandomEvent('unknown', 0)).rejects.toThrow(
        'No wallet found for player unknown',
      );
    });
  });

  describe('revealRandomEvent', () => {
    beforeEach(() => {
      mockAgentService.getWalletInfo.mockResolvedValue({
        walletId: 'wallet-123',
        address: '0xABC',
      });
    });

    it('should throw when no wallet found', async () => {
      mockAgentService.getWalletInfo.mockResolvedValue(null);
      await expect(service.revealRandomEvent('unknown', 0)).rejects.toThrow(
        'No wallet found for player unknown',
      );
    });

    it('should reveal event and log outcome', async () => {
      // Mock Math.random to control roll
      const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.85);

      const result = await service.revealRandomEvent('player1', 0);

      expect(mockRandomService.revealEvent).toHaveBeenCalledWith('wallet-123', '0xABC');
      expect(result.txHash).toBe('0xREVEAL');
      expect(result.outcome).toBeDefined();
      expect(result.outcome.eventType).toBe(0);
      expect(mockTxLogService.log).toHaveBeenCalledWith(
        'player1', '0xABC', 'event_revealed', '0xREVEAL',
        expect.objectContaining({ eventType: 0 }),
      );

      mathRandomSpy.mockRestore();
    });

    it('should handle gacha legendary (roll < 20)', async () => {
      // roll = floor(0.1 * 100) = 10, resType = floor(0.5 * 4) = 2
      const mathRandomSpy = jest.spyOn(Math, 'random')
        .mockReturnValueOnce(0.1)   // roll = 10
        .mockReturnValueOnce(0.5);  // resType = 2 (energy)

      const result = await service.revealRandomEvent('player1', 0);

      expect(result.outcome.roll).toBe(10);
      expect(result.outcome.effects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'legendary', amount: 500 }),
        ]),
      );
      expect(mockBlockchainService.encodeMintResources).toHaveBeenCalledWith('0xABC', 2, 500n);
      expect(mockBlockchainService.ownerSendTransaction).toHaveBeenCalledWith('0xTRADE', '0xDATA');

      mathRandomSpy.mockRestore();
    });

    it('should handle gacha rare (20 <= roll < 50)', async () => {
      // roll = floor(0.35 * 100) = 35
      const mathRandomSpy = jest.spyOn(Math, 'random')
        .mockReturnValueOnce(0.35)  // roll = 35
        .mockReturnValueOnce(0.0);  // resType = 0 (wood)

      const result = await service.revealRandomEvent('player1', 0);

      expect(result.outcome.roll).toBe(35);
      expect(result.outcome.effects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'rare', amount: 200 }),
        ]),
      );

      mathRandomSpy.mockRestore();
    });

    it('should handle gacha common (50 <= roll < 80)', async () => {
      const mathRandomSpy = jest.spyOn(Math, 'random')
        .mockReturnValueOnce(0.6)   // roll = 60
        .mockReturnValueOnce(0.75); // resType = 3 (food)

      const result = await service.revealRandomEvent('player1', 0);

      expect(result.outcome.effects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'common', amount: 50 }),
        ]),
      );

      mathRandomSpy.mockRestore();
    });

    it('should handle gacha nothing (roll >= 80)', async () => {
      const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.9); // roll = 90

      const result = await service.revealRandomEvent('player1', 0);

      expect(result.outcome.effects).toEqual([{ type: 'nothing' }]);
      expect(mockBlockchainService.encodeMintResources).not.toHaveBeenCalled();

      mathRandomSpy.mockRestore();
    });

    it('should handle disaster event (eventType 1)', async () => {
      const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await service.revealRandomEvent('player1', 1);

      expect(result.outcome.effects).toEqual([
        { type: 'disaster', message: 'Disaster struck but no losses (MVP)' },
      ]);

      mathRandomSpy.mockRestore();
    });

    it('should handle trade_bonus event (eventType 2)', async () => {
      // roll = floor(0.5 * 100) = 50, bonusAmount = 500
      const mathRandomSpy = jest.spyOn(Math, 'random')
        .mockReturnValueOnce(0.5)   // roll = 50
        .mockReturnValueOnce(0.25); // resType = 1 (steel)

      const result = await service.revealRandomEvent('player1', 2);

      expect(result.outcome.effects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'trade_bonus', amount: 500 }),
        ]),
      );
      expect(mockBlockchainService.encodeMintResources).toHaveBeenCalledWith('0xABC', 1, 500n);

      mathRandomSpy.mockRestore();
    });

    it('should handle loot event (eventType 3)', async () => {
      // roll = floor(0.5 * 100) = 50, lootAmount = floor(50/10) = 5
      const mathRandomSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);

      const result = await service.revealRandomEvent('player1', 3);

      expect(result.outcome.effects).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ type: 'loot', amountEach: 5 }),
        ]),
      );
      // Should mint for all 4 resource types
      expect(mockBlockchainService.encodeMintResources).toHaveBeenCalledTimes(4);
      expect(mockBlockchainService.ownerSendTransaction).toHaveBeenCalledTimes(4);

      mathRandomSpy.mockRestore();
    });
  });

  describe('getLeaderboard', () => {
    it('should return agents sorted by score descending, alive first', async () => {
      mockAgentService.getAllAgentsIncludingEliminated.mockResolvedValue([
        { playerId: 'p1', address: '0xA', active: true, eliminated: false, isHouseAgent: false, cyclesSurvived: 2 },
        { playerId: 'p2', address: '0xB', active: true, eliminated: false, isHouseAgent: false, cyclesSurvived: 5 },
      ]);

      mockBlockchainService.getAgent
        .mockResolvedValueOnce({ deposit: '100', yieldEarned: '50', strategyType: 1, active: true })
        .mockResolvedValueOnce({ deposit: '500', yieldEarned: '200', strategyType: 1, active: true });

      // All resources 0
      mockBlockchainService.getAgentResources.mockResolvedValue(0n);

      const result = await service.getLeaderboard();

      expect(result.length).toBe(2);
      // p2 score = 500+200 + 0 + 5*100 = 1200 > p1 score = 100+50 + 0 + 2*100 = 350
      expect(result[0].playerId).toBe('p2');
      expect(result[1].playerId).toBe('p1');
      expect(result[0].score).toBe(1200);
      expect(result[1].score).toBe(350);
      expect(result[0].alive).toBe(true);
    });

    it('should return empty array when no agents', async () => {
      mockAgentService.getAllAgentsIncludingEliminated.mockResolvedValue([]);
      const result = await service.getLeaderboard();
      expect(result).toEqual([]);
    });
  });
});
