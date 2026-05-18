import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule } from '@nestjs/config';

import { MailService } from '@/mail/mail.service';
import { MailProcessor } from '@/mail/queue/mail.processor';
import { MailQueueService } from '@/mail/queue/mail-queue.service';
import { MAIL_QUEUE_NAME } from '@/mail/queue/mail-queue.constants';

@Module({
  exports: [MailService, MailQueueService],
  providers: [MailService, MailProcessor, MailQueueService],
  imports: [ConfigModule, BullModule.registerQueue({ name: MAIL_QUEUE_NAME })],
})
export class MailModule {}
