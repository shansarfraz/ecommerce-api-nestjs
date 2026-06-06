import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { Vendor } from '../../vendors/entities/vendor.entity';
import { Order, OrderItem } from '../../orders/entities/order.entity';

export enum CommissionEntryStatus {
  PENDING = 'pending',
  AVAILABLE = 'available',
  PAID = 'paid',
  REVERSED = 'reversed',
}

@Entity('commission_entries')
@Index(['vendorId', 'status'])
@Index(['orderId'])
export class CommissionEntry {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  vendorId: string;

  @ManyToOne(() => Vendor)
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column()
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column()
  orderItemId: string;

  @ManyToOne(() => OrderItem)
  @JoinColumn({ name: 'orderItemId' })
  orderItem: OrderItem;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  grossAmount: number;

  @Column({ type: 'decimal', precision: 5, scale: 2 })
  commissionRate: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  commissionAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  netAmount: number;

  @Column({
    type: 'enum',
    enum: CommissionEntryStatus,
    default: CommissionEntryStatus.PENDING,
  })
  status: CommissionEntryStatus;

  @Column({ type: 'uuid', nullable: true })
  payoutId: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
