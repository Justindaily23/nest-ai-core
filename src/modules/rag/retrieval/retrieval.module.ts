import { Module } from '@nestjs/common';
import { VectorRetrievalService } from './services/vector-retrieval.service';
import { RetrievalRepository } from './repositories/retrieval.repository';
import { PersistenceModule } from '../persistence/persistence.module';

@Module({
  imports: [PersistenceModule],
  providers: [VectorRetrievalService, RetrievalRepository],
  exports: [VectorRetrievalService],
})
export class RetrievalModule {}
