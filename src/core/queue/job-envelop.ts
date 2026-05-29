import { JobExecutionContext } from './job-context';

export interface JobEnvelope<TPayload> {
  readonly context: JobExecutionContext;
  readonly payload: TPayload;
}
