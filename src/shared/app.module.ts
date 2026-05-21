import { Module } from '@nestjs/common';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AppConfigModule } from './config/config.module';
import { LoggerModule } from 'nestjs-pino';
import { AppConfigService } from './config/config.service';

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
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
