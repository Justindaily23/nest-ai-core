import { Module } from '@nestjs/common';
import { VectorRetrievalService } from './services/vector-retrieval.service';
import { RetrievalRepository } from './repositories/retrieval.repository';
import { PersistenceModule } from '../persistence/persistence.module';
import { QueryService } from '../query/query.service';
import { RetrievalExecutionService } from './services/retrieval-execution.service';
import { HybridRetrievalService } from './services/hybrid-retrieval.service';
import { LexicalRetrievalService } from './services/lexical-retrieval.service';
import { VectorRetrieverAdapter } from './adapters/vector-retriever.adapter';
import { ParentExpansionService } from './services/parent-expansion.service';

@Module({
  imports: [PersistenceModule],
  providers: [
    VectorRetrievalService,
    RetrievalRepository,
    QueryService,
    RetrievalExecutionService,
    HybridRetrievalService,
    LexicalRetrievalService,
    VectorRetrievalService,
    VectorRetrieverAdapter,
    ParentExpansionService,
  ],
  exports: [RetrievalExecutionService],
})
export class RetrievalModule {}
