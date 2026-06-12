import { Module } from '@nestjs/common';
import { ContextAssemblyService } from '@modules/rag/context-assembly/service/context-assembly.service';
import { TokenizationModule } from '@/modules/rag/tokenization/tokenization.module';

@Module({
  imports: [TokenizationModule],
  providers: [ContextAssemblyService],
  exports: [ContextAssemblyService],
})
export class ContextAssemblyModule {}
