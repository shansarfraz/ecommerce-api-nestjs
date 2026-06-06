import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

@Entity('notification_log')
@Index(['channel', 'createdAt'])
export class NotificationLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column()
  channel: string;

  @Column()
  template: string;

  @Column()
  toAddress: string;

  @Column()
  subject: string;

  @Column({ type: 'jsonb' })
  payload: object;

  @Column({ default: 'sent' })
  status: string;

  @CreateDateColumn()
  createdAt: Date;
}
