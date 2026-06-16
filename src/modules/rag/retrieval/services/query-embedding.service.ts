import { Injectable } from '@nestjs/common';
import { EmbeddingProvider } from '../../embeddings/interfaces/embedding-provider.interface';

@Injectable()
export class QueryEmbeddingService {
  constructor(private readonly embeddingProvider: EmbeddingProvider) {}

  async embed(query: string): Promise<number[]> {
    const vector = await this.embeddingProvider.embed(query);

    if (!vector?.length) {
      throw new Error('Query embedding returned empty vector');
    }
    return vector;
  }
}
