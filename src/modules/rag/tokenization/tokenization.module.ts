import { Module } from '@nestjs/common';
import { TiktokenTokenizer } from './providers/tiktoken.tokenizer';
import { TokenizerService } from './tokenizer.service';

@Module({
  providers: [
    {
      // Tie the interface provider token directly to the high-performance implementation class
      provide: 'TOKENIZER_PROVIDER',
      useClass: TiktokenTokenizer,
    },
    TokenizerService,
  ],
  // Export the facade service so other modules can count tokens safely
  exports: [TokenizerService],
})
export class TokenizationModule {}
