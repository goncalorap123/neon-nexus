import { Test, TestingModule } from '@nestjs/testing';
import { RandomService } from '../src/random/random.service';
import { BlockchainService } from '../src/blockchain/blockchain.service';

describe('RandomService', () => {
  let service: RandomService;

  const mockBlockchainService = {
    encodeCommitEvent: jest.fn().mockReturnValue('0xCOMMIT_DATA'),
    encodeRevealEvent: jest.fn().mockReturnValue('0xREVEAL_DATA'),
    ownerSendTransaction: jest.fn().mockResolvedValue({ hash: '0xTX' }),
    getRandomEventsAddress: jest.fn().mockReturnValue('0xRANDOM'),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RandomService,
        { provide: BlockchainService, useValue: mockBlockchainService },
      ],
    }).compile();

    service = module.get<RandomService>(RandomService);
    jest.clearAllMocks();
  });

  describe('commitEvent', () => {
    it('should encode and send commit transaction', async () => {
      const result = await service.commitEvent('wallet-123', '0xABC', 2);

      expect(mockBlockchainService.encodeCommitEvent).toHaveBeenCalledWith('0xABC', 2);
      expect(mockBlockchainService.ownerSendTransaction).toHaveBeenCalledWith(
        '0xRANDOM',
        '0xCOMMIT_DATA',
      );
      expect(result).toEqual({ txHash: '0xTX' });
    });

    it('should pass different event types correctly', async () => {
      await service.commitEvent('wallet-456', '0xDEF', 0);

      expect(mockBlockchainService.encodeCommitEvent).toHaveBeenCalledWith('0xDEF', 0);
    });
  });

  describe('revealEvent', () => {
    it('should encode and send reveal transaction', async () => {
      const result = await service.revealEvent('wallet-123', '0xABC');

      expect(mockBlockchainService.encodeRevealEvent).toHaveBeenCalledWith('0xABC');
      expect(mockBlockchainService.ownerSendTransaction).toHaveBeenCalledWith(
        '0xRANDOM',
        '0xREVEAL_DATA',
      );
      expect(result).toEqual({ txHash: '0xTX' });
    });
  });
});
