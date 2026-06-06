import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { StoreCredit } from './store-credit.entity';

export enum StoreCreditTxType {
  CREDIT = 'credit',
  DEBIT = 'debit',
}

@Entity('store_credit_transactions')
export class StoreCreditTransaction {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  creditId: string;

  @ManyToOne(() => StoreCredit)
  @JoinColumn({ name: 'creditId' })
  credit: StoreCredit;

  @Column()
  userId: string;

  @Column({ type: 'enum', enum: StoreCreditTxType })
  txType: StoreCreditTxType;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ nullable: true })
  orderId: string;

  @Column({ nullable: true })
  note: string;

  @CreateDateColumn()
  createdAt: Date;
}
