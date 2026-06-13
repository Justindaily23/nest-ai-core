import { Module } from '@nestjs/common';
import { DocumentRepository } from './repositories/document.repository';
import { ChunkRepository } from './repositories/chunk.repository';
import { EmbeddingRepository } from './repositories/embedding.repository';
import { DatabaseService } from '@/core/database/database.service';

@Module({
  providers: [
    DocumentRepository,
    ChunkRepository,
    EmbeddingRepository,
    DatabaseService,
  ],
  exports: [DocumentRepository, ChunkRepository, EmbeddingRepository],
})
export class PersistenceModule {}
