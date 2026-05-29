import { Job } from 'bullmq';
import { JobEnvelope } from './job-envelop';
import { JobContextRunner } from './job-context-runner';

export abstract class BaseWorker<TPayload> {
  async handle(job: Job<JobEnvelope<TPayload>>): Promise<void> {
    const { context, payload } = job.data;

    if (!context) {
      throw new Error('Missing execution context on job');
    }

    return JobContextRunner.run(context, async () => {
      await this.process(payload);
    });
  }

  protected abstract process(payload: TPayload): Promise<void>;
}
