import { Global, Module } from '@nestjs/common';
import { ConfigModule as NestConfigModule } from '@nestjs/config';
import { AppConfigService } from './config.service';
import { envValidationSchema } from './env.validation';
import configuration from './env.config';

@Global()
@Module({
  imports: [
    NestConfigModule.forRoot({
      cache: true,
      validationSchema: envValidationSchema,
      load: [configuration],
      validationOptions: {
        allowUnknown: true,
      },
    }),
  ],
  providers: [AppConfigService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
