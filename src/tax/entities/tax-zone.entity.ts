import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

@Entity('tax_zones')
@Index(['country', 'state'])
export class TaxZone {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ length: 2 })
  country: string;

  @Column({ nullable: true })
  state: string | null;

  @Column()
  name: string;

  @Column({ type: 'decimal', precision: 6, scale: 4 })
  rate: number;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
