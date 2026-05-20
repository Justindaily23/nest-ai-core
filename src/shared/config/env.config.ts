import { EnvConfig } from './envConfig.interface';

export default (): EnvConfig => ({
  app: {
    node_env: process.env.NODE_ENV || 'development',
    port: parseInt(process.env.PORT || '3000', 10),
  },
  database: {
    database_url: process.env.DATABASE_URL || '',
  },

  redis: {
    redis_url: process.env.REDIS_URL || '',
  },

  llm: {
    provider: process.env.LLM_PROVIDER || 'openai', // Allows easy provider switching
    api_key: process.env.OPENAI_API_KEY || '', // Isolated integration key
  },
});
