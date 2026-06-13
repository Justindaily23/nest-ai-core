import { Module } from '@nestjs/common';
import { ContextAssemblyModule } from './context-assembly/context-assembly.module';
import { TokenizationModule } from './tokenization/tokenization.module';
import { PersistenceModule } from './persistence/persistence.module';
import { ChunkingModule } from './chunking/chunking.module';
import { RetrievalModule } from './retrieval/retrieval.module';
import { CitationBoundaryServiceModule } from './citation-boundaries/citation-boundaries.module';
import { PromptFormattingModule } from './prompt-formatting/prompt-formatting.module';
import { EmbeddingModule } from './embeddings/embedding.module';

@Module({
  imports: [
    ContextAssemblyModule,
    TokenizationModule,
    PersistenceModule,
    ChunkingModule,
    RetrievalModule,
    CitationBoundaryServiceModule,
    PromptFormattingModule,
    EmbeddingModule,
  ],
  exports: [],
})
export class RagModule {}
