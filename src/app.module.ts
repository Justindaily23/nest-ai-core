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
import { ContextModule } from './common/context/context.module';
import { ContextStore } from './common/context/context.store';
import { ContextInterceptor } from './common/context/context.interceptor';
import { ContextAssemblyModule } from './modules/rag/context-assembly/context-assembly.module';
import { TokenizationModule } from './modules/rag/tokenization/tokenization.module';
import { PersistenceModule } from './modules/rag/persistence/persistence.module';
import { ChunkingModule } from './modules/rag/chunking/chunking.module';
import { RetrievalModule } from './modules/rag/retrieval/retrieval.module';

@Module({
  imports: [
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
    ContextModule,
    ContextAssemblyModule,
    TokenizationModule,
    PersistenceModule,
    ChunkingModule,
    RetrievalModule,
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
