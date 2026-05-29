import { AppRequestContext } from '../../common/context/execution-context';

/**
 * Context snapshot serialized into background jobs.
 * Must be JSON-safe.
 */
export interface JobExecutionContext {
  readonly requestId: string;
  readonly actor: AppRequestContext['actor'];
  readonly tenant?: AppRequestContext['tenant'];
  readonly plan?: AppRequestContext['plan'];
  readonly capabilities: AppRequestContext['capabilities'];
  readonly source?: AppRequestContext['source'];
}
