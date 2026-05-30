import { Module } from '@nestjs/common';
import { IngestionRouterService } from '@common/ingestion/ingest-router.service';

@Module({
  providers: [
    IngestionRouterService,
    // Codecs will be registered here (later)
  ],
  exports: [IngestionRouterService],
})
export class IngestionModule {}
