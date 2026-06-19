import { Module } from '@nestjs/common';
import { ContextAssemblyModule } from './context-assembly/context-assembly.module';
import { TokenizationModule } from './tokenization/tokenization.module';
import { PersistenceModule } from './persistence/persistence.module';
import { ChunkingModule } from './chunking/chunking.module';
import { RetrievalModule } from './retrieval/retrieval.module';
import { CitationBoundaryServiceModule } from './citation-boundaries/citation-boundaries.module';
import { PromptFormattingModule } from './prompt-formatting/prompt-formatting.module';
import { EmbeddingModule } from './embeddings/embedding.module';
import { DatabaseModule } from '@/core/database/database.module';
import { AppConfigModule } from '@/config/config.module';
import { QueryModule } from './query/query.module';

@Module({
  imports: [
    DatabaseModule,
    AppConfigModule,
    ContextAssemblyModule,
    TokenizationModule,
    PersistenceModule,
    ChunkingModule,
    RetrievalModule,
    CitationBoundaryServiceModule,
    PromptFormattingModule,
    EmbeddingModule,
    QueryModule,
  ],
  exports: [],
})
export class RagModule {}
