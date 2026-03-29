import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('transaction_logs')
export class TransactionLogEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  playerId: string;

  @Column()
  walletAddress: string;

  @Column({ nullable: true })
  txHash: string;

  @Column()
  action: string; // 'agent_created', 'wallet_funded', 'strategy_changed', 'yield_distributed', 'resources_minted', 'trade_created', 'trade_executed', 'event_committed', 'event_revealed', 'auto_trade'

  @Column({ type: 'text', nullable: true })
  details: string; // JSON string with action-specific details

  @CreateDateColumn()
  createdAt: Date;
}
