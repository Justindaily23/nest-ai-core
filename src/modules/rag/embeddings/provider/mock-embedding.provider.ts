import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { EmbeddingProvider } from '../interfaces/embedding-provider.interface';

@Injectable()
export class MockEmbeddingProvider extends EmbeddingProvider {
  constructor(
    @InjectPinoLogger(MockEmbeddingProvider.name)
    private readonly logger: PinoLogger,
  ) {
    super();
  }

  async embed(content: string): Promise<number[]> {
    this.logger.info(
      { contentLength: content.length },
      'MockEmbeddingProvider: generating random vector — not calling OpenAI',
    );

    // 1536 dimensions matching text-embedding-3-small
    // Values between -1 and 1, guaranteed non-zero
    return Array.from({ length: 1536 }, () => Math.random() * 2 - 1 || 0.1);
  }
}
