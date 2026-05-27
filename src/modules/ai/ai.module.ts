import { Module } from '@nestjs/common';
import { AIService } from './ai.service';
import { AIExecutor } from './ai.executor';
import { AIProviderRegistry } from './ai-provider.registry';
import { OpenAIProvider } from './providers/openai.provider';

@Module({
  providers: [
    AIProviderRegistry,
    AIExecutor,
    AIService,
    OpenAIProvider,
    {
      // Using an internal string token token to run our dynamic registration loop
      provide: 'AI_PROVIDER_BOOTSTRAP',
      inject: [AIProviderRegistry, OpenAIProvider],
      useFactory: (
        registry: AIProviderRegistry,
        openai: OpenAIProvider,
      ): null => {
        // Enforce the name key explicitly as required by our type-safe registry updates
        registry.register('openai', openai);
        return null;
      },
    },
  ],
  // Export both the user-facing service and the orchestrator executor
  // to maximize flexibility for background BullMQ workers in Phase 4
  exports: [AIService, AIExecutor],
})
export class AIModule {}
