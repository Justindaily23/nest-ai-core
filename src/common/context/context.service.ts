import { Injectable } from '@nestjs/common';
import { ContextStore } from './context.store';
import { AppRequestContext, SystemCapability } from './execution-context';

@Injectable()
export class ContextService {
  // Safe getter for mandotry contet paths
  get(): AppRequestContext {
    return ContextStore.get();
  }

  // safely returns context for or undefined for background routines
  getOptional(): AppRequestContext | undefined {
    return ContextStore.getOptional();
  }

  /**
   * Updates the actor property on the active context reference safely.
   */
  setActor(type: AppRequestContext['actor']['type'], id?: string): void {
    const ctx = this.get();
    ctx.actor = { type, id };
  }

  /**
   * Updates the tenant property on the active context reference safely.
   */
  setTenant(id: string): void {
    const ctx = this.get();
    ctx.tenant = { id };
  }

  /**
   * Appends a type-safe system capability to the current request lifecycle.
   */
  addCapability(capability: SystemCapability): void {
    const ctx = this.get();
    if (!ctx.capabilities.includes(capability)) {
      ctx.capabilities.push(capability);
    }
  }
}
