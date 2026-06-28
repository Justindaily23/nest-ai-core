import { InjectQueue } from '@nestjs/bullmq';
import { Injectable } from '@nestjs/common';
import {
  INGESTION_JOB_NAMES,
  INGESTION_QUEUE_NAME,
} from './ingestion-queue.constants';
import { Queue } from 'bullmq';
import { ContextService } from '@/common/context/context.service';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { IngestionJob } from './ingestion-job.types';
import { ContextSerializer } from '@/common/context/context-serialization';

@Injectable()
export class IngestionProducer {
  constructor(
    @InjectQueue(INGESTION_QUEUE_NAME) private readonly queue: Queue,
    private readonly contextService: ContextService,
    @InjectPinoLogger(IngestionProducer.name)
    private readonly logger: PinoLogger,
  ) {}

  async enqueue(payload: IngestionJob): Promise<string> {
    // Snapshot the active request context before it leaves the http boundary
    const activeContext = this.contextService.get();
    const jobContext = ContextSerializer.fromActiveContext(activeContext);

    const job = await this.queue.add(
      INGESTION_JOB_NAMES.PROCESS_DOCUMENT,
      { context: jobContext, payload },
      {
        attempts: 3,
        backoff: { type: 'exponential', delay: 5000 },
        removeOnComplete: { count: 100 },
        removeOnFail: { count: 500 },
      },
    );

    this.logger.info(
      {
        jobId: job.id,
        tenantId: jobContext.tenant?.id,
        documentId: payload.payload.documentId,
      },
      'Document ingestion job enqueued',
    );

    return job.id!;
  }
}
