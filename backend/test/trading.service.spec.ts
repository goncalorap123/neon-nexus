import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TradingService } from '../src/trading/trading.service';
import { TradeOfferEntity } from '../src/database/entities/trade-offer.entity';
import { AgentService } from '../src/agent/agent.service';
import { BlockchainService } from '../src/blockchain/blockchain.service';
import { PrivyService } from '../src/privy/privy.service';

describe('TradingService', () => {
  let service: TradingService;
  let mockOfferRepo: any;
  let mockAgentService: any;
  let mockBlockchain: any;
  let mockPrivy: any;

  beforeEach(async () => {
    mockOfferRepo = {
      find: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn((data) => ({ id: 1, ...data })),
      save: jest.fn((data) => data),
    };

    mockAgentService = {
      getWalletInfo: jest.fn().mockResolvedValue({ walletId: 'w1', address: '0xSELLER' }),
    };

    mockBlockchain = {
      encodeCreateOffer: jest.fn().mockReturnValue('0xDATA'),
      encodeExecuteTrade: jest.fn().mockReturnValue('0xDATA'),
      getAgentTradingAddress: jest.fn().mockReturnValue('0xTRADE'),
      getNextOfferId: jest.fn().mockResolvedValue(1n),
    };

    mockPrivy = {
      sendTransaction: jest.fn().mockResolvedValue({ hash: '0xTX' }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradingService,
        { provide: getRepositoryToken(TradeOfferEntity), useValue: mockOfferRepo },
        { provide: AgentService, useValue: mockAgentService },
        { provide: BlockchainService, useValue: mockBlockchain },
        { provide: PrivyService, useValue: mockPrivy },
      ],
    }).compile();

    service = module.get<TradingService>(TradingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('getActiveOffers', () => {
    it('should return active offers', async () => {
      const offers = [
        { id: 1, active: true, resourceType: 0, quantity: '100' },
        { id: 2, active: true, resourceType: 1, quantity: '50' },
      ];
      mockOfferRepo.find.mockResolvedValue(offers);

      const result = await service.getActiveOffers();
      expect(result).toHaveLength(2);
      expect(mockOfferRepo.find).toHaveBeenCalledWith({
        where: { active: true },
        order: { createdAt: 'DESC' },
      });
    });
  });

  describe('createOffer', () => {
    it('should create an on-chain offer and save to DB', async () => {
      const result = await service.createOffer('player-1', 0, '100', '5');

      expect(mockBlockchain.encodeCreateOffer).toHaveBeenCalledWith('0xSELLER', 0, 100n, 5n);
      expect(mockPrivy.sendTransaction).toHaveBeenCalled();
      expect(mockOfferRepo.save).toHaveBeenCalled();
      expect(result.txHash).toBe('0xTX');
    });

    it('should throw if player has no wallet', async () => {
      mockAgentService.getWalletInfo.mockResolvedValue(null);
      await expect(service.createOffer('unknown', 0, '100', '5')).rejects.toThrow('No wallet found');
    });
  });

  describe('executeTrade', () => {
    it('should execute trade and update offer quantity', async () => {
      mockOfferRepo.findOneBy.mockResolvedValue({
        id: 1,
        onChainOfferId: 0,
        quantity: '100',
        active: true,
      });

      const result = await service.executeTrade('buyer-1', 1, '30');

      expect(mockBlockchain.encodeExecuteTrade).toHaveBeenCalledWith('0xSELLER', 0n, 30n);
      expect(result.txHash).toBe('0xTX');
    });

    it('should deactivate offer when fully consumed', async () => {
      mockOfferRepo.findOneBy.mockResolvedValue({
        id: 1,
        onChainOfferId: 0,
        quantity: '30',
        active: true,
      });

      await service.executeTrade('buyer-1', 1, '30');

      expect(mockOfferRepo.save).toHaveBeenCalledWith(
        expect.objectContaining({ active: false, quantity: '0' }),
      );
    });

    it('should throw if offer not found', async () => {
      mockOfferRepo.findOneBy.mockResolvedValue(null);
      await expect(service.executeTrade('buyer', 999, '10')).rejects.toThrow('not found');
    });
  });
});
