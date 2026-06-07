import { Module } from '@nestjs/common';
import { DocumentRepository } from './repositories/document.repository';
import { ChunkRepository } from './repositories/chunk.repository';

@Module({
  providers: [DocumentRepository, ChunkRepository],
  exports: [DocumentRepository, ChunkRepository],
})
export class PersistenceModule {}
