import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { User } from '../../users/entities/user.entity';
import { Order } from '../../orders/entities/order.entity';

export enum PromotionType {
  PERCENT = 'percent',
  FIXED = 'fixed',
  FREE_SHIPPING = 'free_shipping',
}

export enum PromotionStatus {
  ACTIVE = 'active',
  DISABLED = 'disabled',
}

@Entity('promotions')
export class Promotion {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Index({ unique: true })
  @Column()
  code: string;

  @Column({ type: 'enum', enum: PromotionType })
  type: PromotionType;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  value: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  minOrderSubtotal: number;

  @Column({ type: 'int', nullable: true })
  usageLimit: number | null;

  @Column({ type: 'int', default: 0 })
  usageCount: number;

  @Column({ type: 'int', nullable: true })
  perUserLimit: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  startsAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  endsAt: Date | null;

  @Column({ type: 'uuid', nullable: true })
  vendorId: string | null;

  @Column({
    type: 'enum',
    enum: PromotionStatus,
    default: PromotionStatus.ACTIVE,
  })
  status: PromotionStatus;

  @OneToMany(() => PromotionRedemption, (r) => r.promotion)
  redemptions: PromotionRedemption[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}

@Entity('promotion_redemptions')
@Index(['promotionId', 'userId'])
export class PromotionRedemption {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  promotionId: string;

  @ManyToOne(() => Promotion, (p) => p.redemptions)
  @JoinColumn({ name: 'promotionId' })
  promotion: Promotion;

  @Column()
  userId: string;

  @ManyToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column()
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  discountAmount: number;

  @CreateDateColumn()
  createdAt: Date;
}
