import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigService } from './config/config.service';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { SystemLoggingInterceptor } from './core/interceptors/logging.interceptor';
import { GlobalHttpExceptionFilter } from './common/filters/http-exception.filter';
import { RedisModule } from './core/redis/redis.module';
import { ContextStore } from './common/context/context.store';
import { ContextInterceptor } from './common/context/context.interceptor';
import { RagModule } from './modules/rag/rag.module';
import { DatabaseModule } from './core/database/database.module';
import { BullModule } from '@nestjs/bullmq';
import { IngestionModule } from './modules/ingestion/ingestion.module';

@Module({
  imports: [
    BullModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (config: AppConfigService) => ({
        connection: {
          url: config.redisUrl,
          maxRetriesPerRequest: null,
        },
      }),
    }),
    AppConfigModule,
    LoggerModule.forRootAsync({
      imports: [AppConfigModule],
      inject: [AppConfigService],
      useFactory: (appConfig: AppConfigService) => {
        const isProduction = appConfig.isProduction;
        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            // Mix identity details into the Pino footprint
            mix: () => {
              const ctx = ContextStore.getOptional();
              if (!ctx) return {};
              return {
                requestId: ctx.requestId,
                tenantId: ctx.tenant?.id,
                actorType: ctx.actor.type,
                actorId: ctx.actor.id,
                planTier: ctx.plan?.tier,
              };
            },
            transport: !isProduction
              ? {
                  target: 'pino-pretty',
                  options: {
                    colorize: true,
                    singleLine: true,
                    translateTime: 'SYS:yyyy-mm-dd HH:MM:ss:.l',
                  },
                }
              : undefined,
          },
        };
      },
    }),
    RedisModule,
    RagModule,
    DatabaseModule,
    IngestionModule,
  ],
  controllers: [AppController],
  providers: [
    AppService,
    {
      provide: APP_INTERCEPTOR,
      useClass: ContextInterceptor,
    },
    { provide: APP_INTERCEPTOR, useClass: SystemLoggingInterceptor },
    {
      provide: APP_FILTER,
      useClass: GlobalHttpExceptionFilter,
    },
  ],
})
export class AppModule {}
