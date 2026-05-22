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
  ],
  controllers: [AppController],
  providers: [
    AppService,
    { provide: APP_INTERCEPTOR, useClass: SystemLoggingInterceptor },
    {
      provide: APP_FILTER,
      useClass: GlobalHttpExceptionFilter,
    },
  ],
})
export class AppModule {}
