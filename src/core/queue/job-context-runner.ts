import { ContextStore } from '../../common/context/context.store';
import { JobExecutionContext } from './job-context';
import { AppRequestContext } from '../../common/context/execution-context';

export class JobContextRunner {
  static run<T>(
    jobContext: JobExecutionContext,
    fn: () => Promise<T>,
  ): Promise<T> {
    const hydratedContext: AppRequestContext = {
      requestId: jobContext.requestId,
      timestamp: Date.now(),

      actor: jobContext.actor,
      tenant: jobContext.tenant,
      plan: jobContext.plan,
      capabilities: [...jobContext.capabilities],

      source: jobContext.source ?? {},
    };

    return ContextStore.run(hydratedContext, fn);
  }
}
