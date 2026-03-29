import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { AgentService } from '../src/agent/agent.service';
import { AgentEntity } from '../src/database/entities/agent.entity';
import { PrivyService } from '../src/privy/privy.service';
import { BlockchainService } from '../src/blockchain/blockchain.service';

describe('AgentService', () => {
  let service: AgentService;
  let mockRepo: any;
  let mockPrivy: any;
  let mockBlockchain: any;

  beforeEach(async () => {
    mockRepo = {
      findOneBy: jest.fn(),
      find: jest.fn(),
      create: jest.fn((data) => data),
      save: jest.fn((data) => data),
    };

    mockPrivy = {
      createWallet: jest.fn().mockResolvedValue({ id: 'wallet-123', address: '0xABC' }),
      sendTransaction: jest.fn().mockResolvedValue({ hash: '0xTXHASH' }),
    };

    mockBlockchain = {
      encodeRegisterAgent: jest.fn().mockReturnValue('0xENcoded'),
      encodeDeposit: jest.fn().mockReturnValue('0xENcoded'),
      encodeSetStrategy: jest.fn().mockReturnValue('0xENcoded'),
      getNeonNexusAddress: jest.fn().mockReturnValue('0xCONTRACT'),
      getAgent: jest.fn().mockResolvedValue({
        wallet: '0xABC',
        deposit: 1000n,
        yieldEarned: 50n,
        lastHarvest: 1234n,
        strategyType: 1,
        active: true,
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AgentService,
        { provide: getRepositoryToken(AgentEntity), useValue: mockRepo },
        { provide: PrivyService, useValue: mockPrivy },
        { provide: BlockchainService, useValue: mockBlockchain },
      ],
    }).compile();

    service = module.get<AgentService>(AgentService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('createAgent', () => {
    it('should create a new agent with Privy wallet', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);

      const result = await service.createAgent('player-1');

      expect(mockPrivy.createWallet).toHaveBeenCalled();
      expect(mockBlockchain.encodeRegisterAgent).toHaveBeenCalledWith('0xABC', '0xABC');
      expect(mockPrivy.sendTransaction).toHaveBeenCalled();
      expect(mockRepo.save).toHaveBeenCalled();
      expect(result.walletId).toBe('wallet-123');
      expect(result.address).toBe('0xABC');
      expect(result.txHash).toBe('0xTXHASH');
    });

    it('should return existing agent if already exists', async () => {
      mockRepo.findOneBy.mockResolvedValue({
        playerId: 'player-1',
        walletId: 'wallet-existing',
        address: '0xEXISTING',
      });

      const result = await service.createAgent('player-1');

      expect(mockPrivy.createWallet).not.toHaveBeenCalled();
      expect(result.walletId).toBe('wallet-existing');
      expect(result.txHash).toBe('');
    });
  });

  describe('getAgent', () => {
    it('should return null for unknown player', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      const result = await service.getAgent('unknown');
      expect(result).toBeNull();
    });

    it('should return agent with on-chain state', async () => {
      mockRepo.findOneBy.mockResolvedValue({
        playerId: 'player-1',
        walletId: 'wallet-123',
        address: '0xABC',
      });

      const result = await service.getAgent('player-1');

      expect(result.playerId).toBe('player-1');
      expect(result.onChain.active).toBe(true);
    });
  });

  describe('deposit', () => {
    it('should throw if player has no wallet', async () => {
      mockRepo.findOneBy.mockResolvedValue(null);
      await expect(service.deposit('unknown', 100n)).rejects.toThrow('No wallet found');
    });

    it('should encode and send deposit transaction', async () => {
      mockRepo.findOneBy.mockResolvedValue({ address: '0xABC' });

      const result = await service.deposit('player-1', 1000n);

      expect(mockBlockchain.encodeDeposit).toHaveBeenCalledWith('0xABC', 1000n);
      expect(result.txHash).toBe('0xTXHASH');
    });
  });

  describe('setStrategy', () => {
    it('should update strategy on-chain and in DB', async () => {
      mockRepo.findOneBy.mockResolvedValue({ address: '0xABC', strategyType: 1 });

      const result = await service.setStrategy('player-1', 2);

      expect(mockBlockchain.encodeSetStrategy).toHaveBeenCalledWith('0xABC', 2);
      expect(mockRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ strategyType: 2 }),
      );
      expect(result.txHash).toBe('0xTXHASH');
    });
  });

  describe('getAllAgents', () => {
    it('should return all active agents', async () => {
      mockRepo.find.mockResolvedValue([
        { playerId: 'p1', active: true },
        { playerId: 'p2', active: true },
      ]);

      const agents = await service.getAllAgents();
      expect(agents).toHaveLength(2);
    });
  });
});
