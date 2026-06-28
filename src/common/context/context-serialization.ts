import { ContextService } from './context.service';
import { JobExecutionContext } from '../../core/queue/job-context';

export class ContextSerializer {
  static fromActiveContext(
    ctx: ReturnType<ContextService['get']>,
  ): JobExecutionContext {
    return {
      requestId: ctx.requestId,
      actor: ctx.actor,
      tenant: ctx.tenant,
      plan: ctx.plan,
      capabilities: [...ctx.capabilities],
      source: ctx.source,
    };
  }
}
