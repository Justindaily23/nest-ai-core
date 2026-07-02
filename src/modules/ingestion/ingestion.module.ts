import { Module } from '@nestjs/common';
import { IngestionRouterService } from '@/modules/ingestion/ingest-router.service';
import { PdfSectionBuilder } from './codecs/pdf/pdf.section-builder';
import { PdfParser } from './codecs/pdf/pdf.parser';
import { PdfCodec } from './codecs/pdf/pdf.codec';
import { INGESTION_CODEC_TOKEN } from './ingestion.constants';
import { BullModule } from '@nestjs/bullmq';
import { INGESTION_QUEUE_NAME } from './queue/ingestion-queue.constants';
import { IngestionProducer } from './queue/ingestion.producer';
import { IngestionWorker } from './queue/ingestion.worker';
import { IngestionController } from './ingestion.controller';
import { RagModule } from '../rag/rag.module';
import { TokenizationModule } from '../rag/tokenization/tokenization.module';
import { EmbeddingModule } from '../rag/embeddings/embedding.module';
import { ChunkingModule } from '../rag/chunking/chunking.module';
import { RetrievalModule } from '../rag/retrieval/retrieval.module';
import { CitationBoundaryServiceModule } from '../rag/citation-boundaries/citation-boundaries.module';
import { ContextModule } from '@/common/context/context.module';
import { PersistenceModule } from '../rag/persistence/persistence.module';
import { EventEmitterModule } from '@nestjs/event-emitter';

@Module({
  imports: [
    EventEmitterModule.forRoot(),
    RagModule,
    TokenizationModule,
    EmbeddingModule,
    ChunkingModule,
    RetrievalModule,
    ContextModule,
    CitationBoundaryServiceModule,
    PersistenceModule,
    BullModule.registerQueue({
      name: INGESTION_QUEUE_NAME,
    }),
  ],
  controllers: [IngestionController],
  providers: [
    // Codec implementations
    PdfParser,
    PdfCodec,
    PdfSectionBuilder,

    // Codec array injection — router stays open/closed
    {
      provide: INGESTION_CODEC_TOKEN,
      useFactory: (pdfCodec: PdfCodec) => [pdfCodec],
      inject: [PdfCodec],
    },

    // Core services
    IngestionRouterService,

    // Queue
    IngestionProducer,
    IngestionWorker,
  ],
  exports: [IngestionRouterService, IngestionProducer],
})
export class IngestionModule {}
