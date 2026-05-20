import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from './envConfig.interface';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<EnvConfig>) {}

  get databaseUrl() {
    return this.config.get<string>('database.database_url', { infer: true });
  }

  get redisUrl(): string {
    return this.config.get<string>('redis.redis_url', { infer: true })!;
  }

  get llmProvider(): string {
    return this.config.get<string>('llm.provider', { infer: true })!;
  }

  get openaiApiKey(): string {
    return this.config.get<string>('llm.api_key', { infer: true })!;
  }
}
