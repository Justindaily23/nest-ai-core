import { Module } from '@nestjs/common';
import { RetrievalService } from './services/retrieval.service';
import { RetrievalRepository } from './repositories/retrieval.repository';
import { PersistenceModule } from '../persistence/persistence.module';

@Module({
  imports: [PersistenceModule],
  providers: [RetrievalService, RetrievalRepository],
  exports: [RetrievalService],
})
export class RetrievalModule {}
