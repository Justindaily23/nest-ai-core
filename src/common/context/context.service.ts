import { Injectable } from '@nestjs/common';
import { ContextStore } from './context.store';
import { ExecutionContext } from './execution-context';

@Injectable()
export class ContextService {
  get(): ExecutionContext {
    return ContextStore.get();
  }

  setActor(type: ExecutionContext['actor']['type'], id?: string) {
    const ctx = ContextStore.get();
    ctx.actor = { type, id };
  }

  setTenant(id: string) {
    const ctx = ContextStore.get();
    ctx.tenant = { id };
  }

  addCapability(capability: string) {
    const ctx = ContextStore.get();
    if (!ctx.capabilities.includes(capability)) {
      ctx.capabilities.push(capability);
    }
  }
}
