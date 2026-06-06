import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { NotificationLog } from './notification-log.entity';

export interface NotificationPayload {
  template: string;
  to: string;
  subject: string;
  data: Record<string, any>;
}

export interface NotificationDriver {
  send(p: NotificationPayload): Promise<void>;
}

export class ConsoleDriver implements NotificationDriver {
  private readonly logger = new Logger('NotificationConsoleDriver');
  async send(p: NotificationPayload): Promise<void> {
    this.logger.log(
      `[EMAIL OUT] to=${p.to} subject="${p.subject}" template=${p.template} data=${JSON.stringify(p.data)}`,
    );
  }
}

@Injectable()
export class NotificationsService {
  private readonly driver: NotificationDriver = new ConsoleDriver();

  constructor(
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
  ) {}

  async send(p: NotificationPayload): Promise<void> {
    try {
      await this.driver.send(p);
      await this.logRepo.save(
        this.logRepo.create({
          channel: 'email',
          template: p.template,
          toAddress: p.to,
          subject: p.subject,
          payload: p.data,
          status: 'sent',
        }),
      );
    } catch (err) {
      await this.logRepo.save(
        this.logRepo.create({
          channel: 'email',
          template: p.template,
          toAddress: p.to,
          subject: p.subject,
          payload: { ...p.data, error: String(err) },
          status: 'failed',
        }),
      );
    }
  }
}
