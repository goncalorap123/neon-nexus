import { Entity, PrimaryColumn, Column, UpdateDateColumn } from 'typeorm';

@Entity('agent_actions')
export class AgentActionEntity {
  @PrimaryColumn()
  playerId: string;

  @Column({ default: 'idle' })
  currentAction: string;

  @Column({ type: 'text', nullable: true })
  reasoning: string;

  @Column({ nullable: true })
  targetAgentId: string;

  @Column({ nullable: true })
  targetResourceType: number;

  @UpdateDateColumn()
  updatedAt: Date;
}
