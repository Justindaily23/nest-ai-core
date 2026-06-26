import { Module } from '@nestjs/common';
import { IngestionRouterService } from '@/modules/ingestion/ingest-router.service';
import { PdfSectionBuilder } from './codecs/pdf/pdf.section-builder';
import { PdfParser } from './codecs/pdf/pdf.parser';
import { PdfCodec } from './codecs/pdf/pdf.codec';
import { INGESTION_CODEC_TOKEN } from './ingestion.constants';

@Module({
  providers: [
    IngestionRouterService,
    PdfParser,
    PdfSectionBuilder,
    {
      provide: INGESTION_CODEC_TOKEN,
      useClass: PdfCodec,
    },
  ],
  exports: [IngestionRouterService],
})
export class IngestionModule {}
