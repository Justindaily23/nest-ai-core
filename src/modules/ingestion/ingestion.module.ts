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

@Module({
  imports: [
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
