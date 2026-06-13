import { Module } from '@nestjs/common';
import { EmbeddingService } from './services/embedding.service';
import { EmbeddingRepository } from '../persistence/repositories/embedding.repository';
import { EMBEDDING_PROVIDER_TOKEN } from './interfaces/embedding-provider.interface';
import { OpenAIEmbeddingProvider } from './provider/openai-embedding.provider';

@Module({
  providers: [
    {
      provide: EMBEDDING_PROVIDER_TOKEN,
      useClass: OpenAIEmbeddingProvider,
    },
    EmbeddingService,
    EmbeddingRepository,
  ],
  exports: [EmbeddingService],
})
export class EmbeddingModule {}
