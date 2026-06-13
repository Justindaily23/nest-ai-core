import { Injectable } from '@nestjs/common';
import OpenAI from 'openai';
import { EmbeddingProvider } from '../interfaces/embedding-provider.interface';
import { AppConfigService } from '@/config/config.service';

@Injectable()
export class OpenAIEmbeddingProvider extends EmbeddingProvider {
  private readonly openai: OpenAI;
  private readonly targetModel = 'text-embedding-3-small';

  constructor(private readonly appConfig: AppConfigService) {
    super();
    this.openai = new OpenAI({
      apiKey: this.appConfig.activeLlmApiKey,
    });
  }

  async embed(content: string): Promise<number[]> {
    const response = await this.openai.embeddings.create({
      model: this.targetModel,
      input: content,
      encoding_format: 'float',
    });

    return response.data[0].embedding;
  }
}
