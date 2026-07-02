import { Module } from '@nestjs/common';
import { EmbeddingService } from './services/embedding.service';
import { OpenAIEmbeddingProvider } from './provider/openai-embedding.provider';
import { EmbeddingProvider } from './interfaces/embedding-provider.interface';
import { EmbeddingRepository } from '../persistence/repositories/embedding.repository';
import { MockEmbeddingProvider } from './provider/mock-embedding.provider';

const embeddingProvider = {
  provide: EmbeddingProvider,
  useClass:
    process.env.MOCK_EMBEDDINGS === 'true'
      ? MockEmbeddingProvider
      : OpenAIEmbeddingProvider,
};

@Module({
  imports: [],
  providers: [
    MockEmbeddingProvider,
    EmbeddingService,
    OpenAIEmbeddingProvider,
    EmbeddingRepository,
    embeddingProvider,
    // {
    //   provide: EmbeddingProvider,
    //   useClass: OpenAIEmbeddingProvider,
    // },
  ],
  exports: [EmbeddingService, EmbeddingProvider],
})
export class EmbeddingModule {}
