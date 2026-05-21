export type RedisKey = 'ratelimit' | 'lock' | 'queue' | 'cache' | 'metrics';

export interface RedisLockOptions {
  ttlMs: number;
  retryDelayMs?: number;
  retries?: number;
}
