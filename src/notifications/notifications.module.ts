import { Module, Global } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NotificationsService } from './notifications.service';
import { NotificationLog } from './notification-log.entity';

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([NotificationLog])],
  providers: [NotificationsService],
  exports: [NotificationsService],
})
export class NotificationsModule {}
