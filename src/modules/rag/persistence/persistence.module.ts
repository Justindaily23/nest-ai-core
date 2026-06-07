import { Module } from '@nestjs/common';
import { DocumentRepository } from './repositories/document.repository';
import { ChunkRepository } from './repositories/chunk.repository';
import { EmbeddingRepository } from './repositories/embedding.repository';

@Module({
  providers: [DocumentRepository, ChunkRepository, EmbeddingRepository],
  exports: [DocumentRepository, ChunkRepository, EmbeddingRepository],
})
export class PersistenceModule {}
