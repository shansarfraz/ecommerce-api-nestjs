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

export enum ShippingCalculator {
  FLAT = 'flat',
  PER_ITEM = 'per_item',
  FREE_OVER = 'free_over',
}

@Entity('shipping_methods')
@Index(['vendorId', 'isActive'])
export class ShippingMethod {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', nullable: true })
  vendorId: string | null;

  @ManyToOne(() => Vendor, { nullable: true })
  @JoinColumn({ name: 'vendorId' })
  vendor: Vendor;

  @Column()
  name: string;

  @Column({ type: 'enum', enum: ShippingCalculator })
  calculator: ShippingCalculator;

  @Column({ type: 'decimal', precision: 10, scale: 2 })
  baseAmount: number;

  @Column({ type: 'decimal', precision: 10, scale: 2, default: 0 })
  freeOverSubtotal: number;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  countries: string[];

  @Column({ default: true })
  isActive: boolean;

  @Column({ default: 0 })
  position: number;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
