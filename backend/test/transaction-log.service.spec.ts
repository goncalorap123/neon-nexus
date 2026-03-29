import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TransactionLogService } from '../src/database/transaction-log.service';
import { TransactionLogEntity } from '../src/database/entities/transaction-log.entity';

describe('TransactionLogService', () => {
  let service: TransactionLogService;

  const mockLogRepo = {
    create: jest.fn((d) => d),
    save: jest.fn((d) => ({ id: 1, ...d, createdAt: new Date() })),
    find: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TransactionLogService,
        { provide: getRepositoryToken(TransactionLogEntity), useValue: mockLogRepo },
      ],
    }).compile();

    service = module.get<TransactionLogService>(TransactionLogService);
    jest.clearAllMocks();
  });

  describe('log', () => {
    it('should create and save a log entry with details', async () => {
      const details = { strategy: 2, strategyName: 'Aggressive' };

      const result = await service.log('player1', '0xABC', 'strategy_changed', '0xTX', details);

      expect(mockLogRepo.create).toHaveBeenCalledWith({
        playerId: 'player1',
        walletAddress: '0xABC',
        txHash: '0xTX',
        action: 'strategy_changed',
        details: JSON.stringify(details),
      });
      expect(mockLogRepo.save).toHaveBeenCalled();
      expect(result.playerId).toBe('player1');
    });

    it('should handle missing txHash by defaulting to empty string', async () => {
      await service.log('player1', '0xABC', 'yield_distributed', undefined);

      expect(mockLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ txHash: '' }),
      );
    });

    it('should handle missing details by setting null', async () => {
      await service.log('player1', '0xABC', 'agent_created', '0xTX');

      expect(mockLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ details: null }),
      );
    });

    it('should handle empty string txHash', async () => {
      await service.log('player1', '0xABC', 'resources_minted', '');

      expect(mockLogRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({ txHash: '' }),
      );
    });
  });

  describe('getHistory', () => {
    it('should return logs for a player ordered by createdAt DESC', async () => {
      const logs = [
        { id: 2, playerId: 'player1', action: 'deposit', createdAt: new Date() },
        { id: 1, playerId: 'player1', action: 'agent_created', createdAt: new Date() },
      ];
      mockLogRepo.find.mockResolvedValue(logs);

      const result = await service.getHistory('player1');

      expect(mockLogRepo.find).toHaveBeenCalledWith({
        where: { playerId: 'player1' },
        order: { createdAt: 'DESC' },
        take: 50,
      });
      expect(result).toEqual(logs);
    });

    it('should respect custom limit', async () => {
      mockLogRepo.find.mockResolvedValue([]);

      await service.getHistory('player1', 10);

      expect(mockLogRepo.find).toHaveBeenCalledWith({
        where: { playerId: 'player1' },
        order: { createdAt: 'DESC' },
        take: 10,
      });
    });
  });

  describe('getRecentAll', () => {
    it('should return all recent logs with default limit 100', async () => {
      const logs = [{ id: 1, action: 'test' }];
      mockLogRepo.find.mockResolvedValue(logs);

      const result = await service.getRecentAll();

      expect(mockLogRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 100,
      });
      expect(result).toEqual(logs);
    });

    it('should respect custom limit', async () => {
      mockLogRepo.find.mockResolvedValue([]);

      await service.getRecentAll(25);

      expect(mockLogRepo.find).toHaveBeenCalledWith({
        order: { createdAt: 'DESC' },
        take: 25,
      });
    });
  });
});
