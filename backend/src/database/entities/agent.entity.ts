import { Entity, PrimaryColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('agents')
export class AgentEntity {
  @PrimaryColumn()
  playerId: string;

  @Column()
  walletId: string;

  @Column()
  address: string;

  @Column({ default: 1 })
  strategyType: number;

  @Column({ default: true })
  active: boolean;

  @Column({ default: false })
  isHouseAgent: boolean;

  @Column({ default: 0 })
  cyclesSurvived: number;

  @Column({ default: false })
  eliminated: boolean;

  @Column({ type: 'datetime', nullable: true, default: null })
  eliminatedAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
