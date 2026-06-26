import { Module } from '@nestjs/common';
import { EmbeddingService } from './services/embedding.service';
import { OpenAIEmbeddingProvider } from './provider/openai-embedding.provider';
import { EmbeddingProvider } from './interfaces/embedding-provider.interface';
import { EmbeddingRepository } from '../persistence/repositories/embedding.repository';

@Module({
  imports: [],
  providers: [
    EmbeddingService,
    OpenAIEmbeddingProvider,
    EmbeddingRepository,
    {
      provide: EmbeddingProvider,
      useClass: OpenAIEmbeddingProvider,
    },
  ],
  exports: [EmbeddingService, EmbeddingProvider],
})
export class EmbeddingModule {}
