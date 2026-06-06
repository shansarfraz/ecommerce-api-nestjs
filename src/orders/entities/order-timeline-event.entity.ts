import {
  Entity, PrimaryGeneratedColumn, Column, CreateDateColumn,
  ManyToOne, JoinColumn,
} from 'typeorm';
import { Order } from './order.entity';

export enum TimelineEventType {
  STATUS_CHANGE = 'status_change',
  NOTE = 'note',
  PAYMENT = 'payment',
  SHIPMENT = 'shipment',
  RETURN = 'return',
  ADJUSTMENT = 'adjustment',
  STORE_CREDIT = 'store_credit',
}

@Entity('order_timeline_events')
export class OrderTimelineEvent {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  orderId: string;

  @ManyToOne(() => Order)
  @JoinColumn({ name: 'orderId' })
  order: Order;

  @Column({ type: 'enum', enum: TimelineEventType })
  eventType: TimelineEventType;

  @Column({ type: 'text' })
  description: string;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, any>;

  @Column({ nullable: true })
  actorId: string;

  @Column({ nullable: true })
  actorRole: string;

  @CreateDateColumn()
  createdAt: Date;
}
