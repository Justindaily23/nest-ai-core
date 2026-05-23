import { Inject, Injectable, OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';
import { REDIS_CLIENT } from './redis.constants';
import { InjectPinoLogger } from 'nestjs-pino';
import { PinoLogger } from 'nestjs-pino';
import { RedisKey, RedisLockOptions } from './redis.types';
import { REDIS_NAMESPACE } from './redis.constants';
import { RedisServiceLogPayload } from '../../common/logging/logging.types';
import { RedisOperationException } from '@/common/exceptions/redis-operation.exception';
import { randomUUID } from 'crypto';

@Injectable()
export class RedisService implements OnModuleDestroy {
  constructor(
    @Inject(REDIS_CLIENT) private readonly redis: Redis,
    @InjectPinoLogger(RedisService.name) private readonly logger: PinoLogger,
  ) {}

  /*========= Core Helpers =========*/
  private buildKey(domain: RedisKey, key: string) {
    return `${REDIS_NAMESPACE}:${domain}:${key}`;
  }

  /*========= Key Value Operations=========*/
  async get(domain: RedisKey, key: string): Promise<string | null> {
    try {
      return await this.redis.get(this.buildKey(domain, key));
    } catch (error) {
      const logPayLoad: RedisServiceLogPayload = {
        system: 'redis',
        domain,
        key,
        err: error,
      };
      this.logger.error(logPayLoad, 'Failed to fetch key from redis');
      throw new RedisOperationException(
        `Failed to retrieve cached ${domain} data`,
        error,
      );
    }
  }

  async set(
    domain: RedisKey,
    key: string,
    value: string,
    ttlSeconds?: number,
  ): Promise<string> {
    const redisKey = this.buildKey(domain, key);

    try {
      if (ttlSeconds) {
        return await this.redis.set(redisKey, value, 'EX', ttlSeconds);
      }
      return await this.redis.set(redisKey, value);
    } catch (error) {
      const logPayLoad: RedisServiceLogPayload = {
        system: 'redis',
        domain,
        key,
        err: error,
      };
      this.logger.error(logPayLoad, 'Failed to set key in redis');
      throw new RedisOperationException(
        `Failed to cache ${domain} data`,
        error,
      );
    }
  }

  async del(domain: RedisKey, key: string): Promise<number> {
    const redisKey = this.buildKey(domain, key);
    try {
      return await this.redis.del(redisKey);
    } catch (error) {
      const logPayLoad: RedisServiceLogPayload = {
        system: 'redis',
        domain,
        key,
        err: error,
      };
      this.logger.error(logPayLoad, 'Failed to delete key from redis');
      throw new RedisOperationException(
        `Failed to delete cached ${domain} data`,
        error,
      );
    }
  }

  async incr(domain: RedisKey, key: string): Promise<number> {
    const rediskey = this.buildKey(domain, key);
    try {
      return await this.redis.incr(rediskey);
    } catch (error) {
      const logPayLoad: RedisServiceLogPayload = {
        system: 'redis',
        domain,
        key,
        err: error,
      };
      this.logger.error(logPayLoad, 'Failed to increment key in redis');
      throw new RedisOperationException(
        `Failed to increment cached ${domain} data`,
        error,
      );
    }
  }

  async ttl(domain: RedisKey, key: string): Promise<number> {
    const rediskey = this.buildKey(domain, key);
    try {
      return await this.redis.ttl(rediskey);
    } catch (error) {
      const logPayLoad: RedisServiceLogPayload = {
        system: 'redis',
        domain,
        key,
        err: error,
      };
      this.logger.error(logPayLoad, 'Failed to get TTL of key from redis');
      throw new RedisOperationException(
        `Failed to get TTL of cached ${domain} data`,
        error,
      );
    }
  }

  /* ditribiuted locking */

  async acquireLock(
    domain: RedisKey,
    key: string,
    options: RedisLockOptions,
  ): Promise<string | null> {
    const lockKey = this.buildKey(domain, key);
    const token = randomUUID(); // Unique token to identify the lock owner

    try {
      const acquired = await this.redis.set(
        lockKey,
        token,
        'PX',
        options.ttlMs,
        'NX',
      );
      return acquired ? token : null;
    } catch (error) {
      const logPayLoad: RedisServiceLogPayload = {
        system: 'redis',
        domain,
        key,
        err: error,
      };
      this.logger.error(logPayLoad, 'Failed to acquire lock in redis');
      throw new RedisOperationException(
        `Distributed lock acquisition failed for ${domain}`,
        error,
      );
    }
  }

  async releaseLock(
    domain: RedisKey,
    key: string,
    token: string,
  ): Promise<boolean> {
    const lockKey = this.buildKey(domain, key);

    const lua = `
        if redis.call("get", KEYS[1]) == ARGV[1] then
            return redis.call("del", KEYS[1])
        end
        return 0
    `;

    try {
      const result = await this.redis.eval(lua, 1, lockKey, token);
      return result === 1;
    } catch (error) {
      const logPayLoad: RedisServiceLogPayload = {
        system: 'redis',
        domain,
        key,
        err: error,
      };
      this.logger.error(logPayLoad, 'Failed to release lock in redis');
      throw new RedisOperationException(
        `Distributed lock release failed for ${domain}`,
        error,
      );
    }
  }

  /*-- Health ---*/
  async ping() {
    try {
      const response = await this.redis.ping();
      return response === 'PONG';
    } catch (error) {
      const logPayLoad: RedisServiceLogPayload = {
        system: 'redis',
        domain: 'health',
        key: 'ping',
        err: error,
      };
      this.logger.error(logPayLoad, 'Redis core instance  health check failed');
      throw new RedisOperationException(`Redis health check failed`, error);
    }
  }
  /*--- Shutdwon ---*/
  async onModuleDestroy() {
    this.logger.info('Closing Redis connection');
    try {
      await this.redis.quit();
      this.logger.info('Redis connection closed gracefully');
    } catch (error) {
      const logPayLoad: RedisServiceLogPayload = {
        system: 'redis',
        domain: 'lifecycle',
        key: 'shutdown',
        err: error,
      };
      this.logger.error(
        logPayLoad,
        'Error occurred while closing Redis connection',
      );
    }
  }
}
