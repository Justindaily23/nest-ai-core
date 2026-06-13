import { Module } from '@nestjs/common';
import { CitationBoundaryService } from './services/citation-boundary.service';

@Module({
  providers: [CitationBoundaryService],
  exports: [CitationBoundaryService],
})
export class CitationBoundaryServiceModule {}
