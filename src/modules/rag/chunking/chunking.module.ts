import { Module } from '@nestjs/common';
import { TokenizationModule } from '@/modules/rag/tokenization/tokenization.module';
import { ParentChildChunkerService } from './parent-child-chunker.service';

@Module({
  imports: [TokenizationModule],
  providers: [ParentChildChunkerService],
  exports: [ParentChildChunkerService],
})
export class ChunkingModule {}
