import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  UpdateDateColumn, ManyToOne, JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';

export enum StoreCreditType {
  EARNED = 'earned',
  ISSUED = 'issued',
  REFUND = 'refund',
  ADJUSTED = 'adjusted',
}

export enum StoreCreditStatus {
  ACTIVE = 'active',
  USED = 'used',
  EXPIRED = 'expired',
  VOIDED = 'voided',
}

@Entity('store_credits')
export class StoreCredit {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  amount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  usedAmount: number;

  @Column({ type: 'enum', enum: StoreCreditType })
  type: StoreCreditType;

  @Column({ type: 'enum', enum: StoreCreditStatus, default: StoreCreditStatus.ACTIVE })
  status: StoreCreditStatus;

  @Column({ default: 'USD' })
  currency: string;

  @Column({ nullable: true })
  reason: string;

  @Column({ nullable: true })
  orderId: string;

  @Column({ nullable: true })
  expiresAt: Date;

  @Column({ nullable: true })
  issuedByAdminId: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
