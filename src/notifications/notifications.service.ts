import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
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

export class SendGridDriver implements NotificationDriver {
  private readonly logger = new Logger('SendGridDriver');
  private sgMail: any;

  constructor(private readonly apiKey: string) {
    try {
      // eslint-disable-next-line @typescript-eslint/no-var-requires
      const sg = require('@sendgrid/mail');
      sg.setApiKey(apiKey);
      this.sgMail = sg;
    } catch {
      this.logger.warn('@sendgrid/mail not installed — falling back to console logging');
    }
  }

  async send(p: NotificationPayload): Promise<void> {
    if (!this.sgMail) {
      new ConsoleDriver().send(p);
      return;
    }
    await this.sgMail.send({
      to: p.to,
      from: process.env.EMAIL_FROM ?? 'noreply@marketplace.com',
      subject: p.subject,
      text: JSON.stringify(p.data),
      html: `<pre>${JSON.stringify(p.data, null, 2)}</pre>`,
    });
    this.logger.log(`Email sent to ${p.to} via SendGrid — template: ${p.template}`);
  }
}

@Injectable()
export class NotificationsService {
  private driver: NotificationDriver;

  constructor(
    @InjectRepository(NotificationLog)
    private readonly logRepo: Repository<NotificationLog>,
    private readonly config: ConfigService,
  ) {
    const emailDriver = config.get<string>('EMAIL_DRIVER', 'console');
    if (emailDriver === 'sendgrid') {
      const key = config.get<string>('SENDGRID_API_KEY', '');
      this.driver = new SendGridDriver(key);
    } else {
      this.driver = new ConsoleDriver();
    }
  }

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
