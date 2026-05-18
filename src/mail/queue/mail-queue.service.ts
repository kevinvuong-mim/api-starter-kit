import { Queue } from 'bullmq';
import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';

import { SendVerificationEmailJobData } from './mail-queue.types';
import { MAIL_QUEUE_NAME, SEND_VERIFICATION_EMAIL_JOB } from './mail-queue.constants';

@Injectable()
export class MailQueueService {
  constructor(
    @InjectQueue(MAIL_QUEUE_NAME)
    private readonly mailQueue: Queue<SendVerificationEmailJobData>,
  ) {}

  async enqueueVerificationEmail(data: SendVerificationEmailJobData) {
    await this.mailQueue.add(SEND_VERIFICATION_EMAIL_JOB, data, {
      attempts: 5,
      removeOnComplete: {
        count: 1000,
        age: 24 * 60 * 60,
      },
      backoff: {
        delay: 3000,
        type: 'exponential',
      },
      removeOnFail: {
        age: 7 * 24 * 60 * 60,
      },
    });
  }
}
