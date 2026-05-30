import * as Joi from 'joi';
import { LlmProvider } from '@/common/enums/llm-provider.enum';

export const envValidationSchema = Joi.object({
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'test')
    .default('development'),
  LLM_PROVIDER: Joi.string()
    .valid(...Object.values(LlmProvider))
    .default(LlmProvider.OPENAI),
  PORT: Joi.number().default(3000),
  DATABASE_URL: Joi.string().required(),
  OPENAI_API_KEY: Joi.string().required(),
  REDIS_URL: Joi.string().required(),
});
