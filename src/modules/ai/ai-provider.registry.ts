import { Injectable } from '@nestjs/common';
import { AIProviderName } from './ai.types';
import { AIProvider } from './ai.provider';
import { OperationalException } from '@/common/exceptions/operational.exception';

@Injectable()
export class AIProviderRegistry {
  // Enforce strict union as map key instead of a raw string
  private readonly providers = new Map<AIProviderName, AIProvider>();

  // Register a AI provider driver into the system
  register(name: AIProviderName, provider: AIProvider): void {
    this.providers.set(name, provider);
  }

  /**
   * Resolves and retrieves the requested AI provider driver
   * throws a clear exception if the provider is missing or not registered
   */
  resolve(name: AIProviderName): AIProvider {
    const provider = this.providers.get(name);

    if (!provider) {
      throw new OperationalException(
        'system',
        'AI_PROVIDER_NOT_REGISTERED',
        `AI provider ${name} is not registered in the system.`,
        500,
      );
    }
    return provider;
  }
}
