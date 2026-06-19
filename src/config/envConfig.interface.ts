// Dedicated interface for database configurations
export interface DatabaseConfig {
  database_url: string;
}

// Dedicated interface for redis configurations
export interface RedisConfig {
  redis_url: string;
}

// Dedicated interface for AI/LLM configurations
export interface LlmConfig {
  provider: string; // e.g., 'openai', 'anthropic'
  api_key: string;
  model: string;
}

// Dedicated interface for app specific configurations
export interface AppConfig {
  node_env: string;
  port: number;
}
export interface RagConfig {
  token_budget: number;
}

// Master interface combining everything
export interface EnvConfig {
  app: AppConfig;
  database: DatabaseConfig;
  redis: RedisConfig;
  llm: LlmConfig;
  rag: RagConfig;
}
