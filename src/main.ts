import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { AppConfigService } from './config/config.service';
import { ValidationPipe } from '@nestjs/common';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      connectionTimeout: 10000, // 10 seconds to estbalish a connection
      requestTimeout: 15000, // 15 seconds to process a request
    }),
    { bufferLogs: true },
  );

  //Global routing version prefix
  app.setGlobalPrefix('api/v1');

  // Use the custom logger from nestjs-pino
  app.useLogger(app.get(Logger));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));

  // Get the custom config service
  const config = app.get(AppConfigService);
  await app.listen(config.port || 3000, '0.0.0.0');
}
bootstrap();
