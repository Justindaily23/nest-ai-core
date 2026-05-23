import { Global, Module } from '@nestjs/common';
import { RedisService } from './redis.service';
import { REDIS_CLIENT } from './redis.constants';
import { AppConfigService } from '@/config/config.service';
import Redis from 'ioredis';
import { Logger } from 'nestjs-pino';

@Global()
@Module({
  imports: [],
  providers: [
    RedisService,
    {
      provide: REDIS_CLIENT,
      inject: [AppConfigService, Logger],
      useFactory: async (config: AppConfigService, logger: Logger) => {
        const client = new Redis(config.redisUrl, {
          maxRetriesPerRequest: null,
          enableReadyCheck: true,
          lazyConnect: false,
        });

        client.on('connect', () => {
          logger.log(
            { system: 'Redis' },
            'Successfully connected to Redis',
            'RedisModule',
          );
        });

        client.on('error', (error) => {
          logger.error(
            { system: 'Redis', err: error },
            'Redis connection pool encountered an error',
            'RedisModule',
          );
        });

        return client;
      },
    },
  ],
  exports: [RedisService, REDIS_CLIENT],
})
export class RedisModule {}
