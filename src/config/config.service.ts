import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EnvConfig } from './envConfig.interface';

@Injectable()
export class AppConfigService {
  constructor(private readonly config: ConfigService<EnvConfig>) {}

  get port(): number {
    return this.config.get<number>('app.port', { infer: true })!;
  }

  get databaseUrl(): string {
    return this.config.get<string>('database.database_url', { infer: true })!;
  }

  get redisUrl(): string {
    return this.config.get<string>('redis.redis_url', { infer: true })!;
  }

  get llmProvider(): string {
    return this.config.get<string>('llm.provider', { infer: true })!;
  }

  get activeLlmApiKey(): string {
    return this.config.get<string>('llm.api_key', { infer: true })!;
  }

  get isProduction(): boolean {
    return (
      this.config.get<string>('app.node_env', { infer: true }) === 'production'
    );
  }

  // Boolean helper for Development checks
  get isDevelopment(): boolean {
    return (
      this.config.get<string>('app.node_env', { infer: true }) === 'development'
    );
  }

  // Boolean helper for Test suites (highly useful for CI/CD pipelines later)
  get isTest(): boolean {
    return this.config.get<string>('app.node_env', { infer: true }) === 'test';
  }
}
