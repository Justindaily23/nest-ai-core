import { Job } from 'bullmq';
import { JobEnvelope } from './job-envelop';
import { JobContextRunner } from './job-context-runner';
import { WorkerHost } from '@nestjs/bullmq';

export abstract class BaseWorker<TPayload> extends WorkerHost {
  constructor() {
    super();
  }
  async process(job: Job<JobEnvelope<TPayload>>): Promise<void> {
    const { context, payload } = job.data;

    if (!context) {
      throw new Error('Missing execution context on job');
    }

    return JobContextRunner.run(context, async () => {
      await this.handle(job, payload);
    });
  }

  protected abstract handle(
    job: Job<JobEnvelope<TPayload>>,
    payload: TPayload,
  ): Promise<void>;
}
