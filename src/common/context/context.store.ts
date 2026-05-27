/**Its purpose is to make ExecutionContext globally readable anywhere inside the application without forcing you to pass it manually through every function parameter. */
// Wraps Node's native storage to make the request context global.
// This stops us from having to pass "context" as a variable into every function
import { AsyncLocalStorage } from 'node:async_hooks';
import { AppRequestContext } from './execution-context';
import { OperationalException } from '../exceptions/operational.exception';

export class ContextStore {
  private static readonly storage = new AsyncLocalStorage<AppRequestContext>();

  // Bootsup the execution context loop
  static run<T>(context: AppRequestContext, fn: () => T): T {
    return this.storage.run(context, fn);
  }

  // Grab the active request clipboard from anywhere in the app
  static get(): AppRequestContext {
    const ctx = this.storage.getStore();
    if (!ctx) {
      // Hard fail if we try to access context before it's been initialized. This likely means we're trying to access it outside of a request lifecycle, which is a bug.
      throw new OperationalException(
        'system',
        'CONTEXT_NOT_INITIALIZED',
        'ExecutionContext not initialized. Is ContextInterceptor missing?',
        500,
      );
    }
    return ctx;
  }

  /**
   * Returns the current context if inside an active request execution path,
   * otherwise returns undefined without throwing an exception.
   */
  static getOptional(): AppRequestContext | undefined {
    return this.storage.getStore();
  }
}
