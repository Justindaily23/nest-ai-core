import { NestFactory } from '@nestjs/core';
import {
  FastifyAdapter,
  NestFastifyApplication,
} from '@nestjs/platform-fastify';
import { AppModule } from './app.module';
import { Logger } from 'nestjs-pino';
import { AppConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter(),
    { bufferLogs: true },
  );

  //Global routing version prefix
  app.setGlobalPrefix('api/v1');

  // Use the custom logger from nestjs-pino
  app.useLogger(app.get(Logger));

  // Get the custom config service
  const config = app.get(AppConfigService);
  await app.listen(config.port || 3000, '0.0.0.0');
}
bootstrap();
