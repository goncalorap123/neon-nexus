import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { TradingService } from '../src/trading/trading.service';
import { TradeOfferEntity } from '../src/database/entities/trade-offer.entity';
import { AgentService } from '../src/agent/agent.service';
import { BlockchainService } from '../src/blockchain/blockchain.service';

describe('TradingService', () => {
  let service: TradingService;

  const mockOfferRepo = {
    find: jest.fn(),
    findOneBy: jest.fn(),
    create: jest.fn((d) => ({ id: 1, ...d })),
    save: jest.fn((d) => d),
  };

  const mockAgentService = {
    getWalletInfo: jest.fn(),
  };

  const mockBlockchainService = {
    encodeCreateOffer: jest.fn().mockReturnValue('0xCREATE'),
    encodeExecuteTrade: jest.fn().mockReturnValue('0xEXEC'),
    ownerSendTransaction: jest.fn().mockResolvedValue({ hash: '0xTX' }),
    getAgentTradingAddress: jest.fn().mockReturnValue('0xTRADE'),
    getNextOfferId: jest.fn().mockResolvedValue(5n),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        TradingService,
        { provide: getRepositoryToken(TradeOfferEntity), useValue: mockOfferRepo },
        { provide: AgentService, useValue: mockAgentService },
        { provide: BlockchainService, useValue: mockBlockchainService },
      ],
    }).compile();

    service = module.get<TradingService>(TradingService);
    jest.clearAllMocks();
  });

  describe('getActiveOffers', () => {
    it('should return active offers ordered by createdAt DESC', async () => {
      const offers = [
        { id: 2, active: true, createdAt: new Date() },
        { id: 1, active: true, createdAt: new Date() },
      ];
      mockOfferRepo.find.mockResolvedValue(offers);

      const result = await service.getActiveOffers();

      expect(mockOfferRepo.find).toHaveBeenCalledWith({
        where: { active: true },
        order: { createdAt: 'DESC' },
      });
      expect(result).toEqual(offers);
    });
  });

  describe('createOffer', () => {
    it('should create offer on-chain and save to DB', async () => {
      mockAgentService.getWalletInfo.mockResolvedValue({
        walletId: 'wallet-123',
        address: '0xABC',
      });

      const result = await service.createOffer('player1', 0, '100', '2');

      expect(mockBlockchainService.encodeCreateOffer).toHaveBeenCalledWith(
        '0xABC', 0, 100n, 2n,
      );
      expect(mockBlockchainService.ownerSendTransaction).toHaveBeenCalledWith(
        '0xTRADE', '0xCREATE',
      );
      expect(mockBlockchainService.getNextOfferId).toHaveBeenCalled();

      // nextId = 5 - 1 = 4
      expect(mockOfferRepo.create).toHaveBeenCalledWith({
        onChainOfferId: 4,
        sellerPlayerId: 'player1',
        sellerAddress: '0xABC',
        resourceType: 0,
        quantity: '100',
        pricePerUnit: '2',
        txHash: '0xTX',
      });
      expect(mockOfferRepo.save).toHaveBeenCalled();
      expect(result).toEqual({ offerId: 1, txHash: '0xTX' });
    });

    it('should throw when no wallet found', async () => {
      mockAgentService.getWalletInfo.mockResolvedValue(null);

      await expect(service.createOffer('unknown', 0, '100', '1')).rejects.toThrow(
        'No wallet found for player unknown',
      );
      expect(mockBlockchainService.ownerSendTransaction).not.toHaveBeenCalled();
    });
  });

  describe('executeTrade', () => {
    beforeEach(() => {
      mockAgentService.getWalletInfo.mockResolvedValue({
        walletId: 'wallet-buyer',
        address: '0xBUYER',
      });
    });

    it('should execute partial trade and update remaining quantity', async () => {
      const offer = {
        id: 1,
        onChainOfferId: 4,
        quantity: '100',
        active: true,
      };
      mockOfferRepo.findOneBy.mockResolvedValue(offer);

      const result = await service.executeTrade('buyer1', 1, '30');

      expect(mockBlockchainService.encodeExecuteTrade).toHaveBeenCalledWith(
        '0xBUYER', 4n, 30n,
      );
      expect(mockBlockchainService.ownerSendTransaction).toHaveBeenCalledWith(
        '0xTRADE', '0xEXEC',
      );

      // 100 - 30 = 70 remaining, still active
      expect(offer.quantity).toBe('70');
      expect(offer.active).toBe(true);
      expect(mockOfferRepo.save).toHaveBeenCalledWith(offer);
      expect(result).toEqual({ txHash: '0xTX' });
    });

    it('should deactivate offer when fully consumed', async () => {
      const offer = {
        id: 1,
        onChainOfferId: 4,
        quantity: '50',
        active: true,
      };
      mockOfferRepo.findOneBy.mockResolvedValue(offer);

      await service.executeTrade('buyer1', 1, '50');

      expect(offer.quantity).toBe('0');
      expect(offer.active).toBe(false);
      expect(mockOfferRepo.save).toHaveBeenCalledWith(offer);
    });

    it('should deactivate offer when buying more than available (negative remaining)', async () => {
      const offer = {
        id: 1,
        onChainOfferId: 4,
        quantity: '30',
        active: true,
      };
      mockOfferRepo.findOneBy.mockResolvedValue(offer);

      await service.executeTrade('buyer1', 1, '50');

      // remainingQty = 30 - 50 = -20 <= 0, so deactivate
      expect(offer.active).toBe(false);
    });

    it('should throw when offer not found', async () => {
      mockOfferRepo.findOneBy.mockResolvedValue(null);

      await expect(service.executeTrade('buyer1', 999, '10')).rejects.toThrow(
        'Offer 999 not found or inactive',
      );
    });

    it('should throw when buyer has no wallet', async () => {
      mockAgentService.getWalletInfo.mockResolvedValue(null);

      await expect(service.executeTrade('unknown', 1, '10')).rejects.toThrow(
        'No wallet found for player unknown',
      );
    });
  });
});
