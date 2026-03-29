import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { TransactionLogEntity } from './entities/transaction-log.entity';

@Injectable()
export class TransactionLogService {
  constructor(
    @InjectRepository(TransactionLogEntity)
    private readonly logRepo: Repository<TransactionLogEntity>,
  ) {}

  async log(
    playerId: string,
    walletAddress: string,
    action: string,
    txHash?: string,
    details?: Record<string, any>,
  ): Promise<TransactionLogEntity> {
    const entry = this.logRepo.create({
      playerId,
      walletAddress,
      txHash: txHash || '',
      action,
      details: details ? JSON.stringify(details) : null,
    });
    return this.logRepo.save(entry);
  }

  async getHistory(playerId: string, limit = 50): Promise<TransactionLogEntity[]> {
    return this.logRepo.find({
      where: { playerId },
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }

  async getRecentAll(limit = 100): Promise<TransactionLogEntity[]> {
    return this.logRepo.find({
      order: { createdAt: 'DESC' },
      take: limit,
    });
  }
}
