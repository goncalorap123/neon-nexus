import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn } from 'typeorm';

@Entity('trade_offers')
export class TradeOfferEntity {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  onChainOfferId: number;

  @Column()
  sellerPlayerId: string;

  @Column()
  sellerAddress: string;

  @Column()
  resourceType: number;

  @Column({ type: 'text' })
  quantity: string;

  @Column({ type: 'text' })
  pricePerUnit: string;

  @Column({ default: true })
  active: boolean;

  @Column({ nullable: true })
  txHash: string;

  @CreateDateColumn()
  createdAt: Date;
}
