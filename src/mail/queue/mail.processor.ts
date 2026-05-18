import { Job } from 'bullmq';
import { Logger, Injectable } from '@nestjs/common';
import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';

import { MailService } from '@/mail/mail.service';
import { SendVerificationEmailJobData } from './mail-queue.types';
import { MAIL_QUEUE_NAME, SEND_VERIFICATION_EMAIL_JOB } from './mail-queue.constants';

@Injectable()
@Processor(MAIL_QUEUE_NAME)
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly mailService: MailService) {
    super();
  }

  async process(job: Job<SendVerificationEmailJobData>) {
    switch (job.name) {
      case SEND_VERIFICATION_EMAIL_JOB: {
        const { email, token, frontendUrl } = job.data;

        await this.mailService.sendVerificationEmail(email, token, frontendUrl);
        return;
      }

      default:
        throw new Error(`Unsupported mail job: ${job.name}`);
    }
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job | undefined, error: Error) {
    this.logger.error(`Mail job failed${job ? ` (${job.name}, id=${job.id})` : ''}`, error.stack);
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job) {
    this.logger.debug(`Mail job completed (${job.name}, id=${job.id})`);
  }
}
