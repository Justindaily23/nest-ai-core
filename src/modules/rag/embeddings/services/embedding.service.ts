import { Injectable } from '@nestjs/common';
import { EmbeddingRepository } from '../../persistence/repositories/embedding.repository';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { GenerateChunkingEmbeddingParams } from '../interfaces/embedding-service.interface';
import { type EmbeddingProvider } from '../interfaces/embedding-provider.interface';
import { EmbeddingGenerationException } from '../exceptions/embedding.exception';

@Injectable()
export class EmbeddingService {
  constructor(
    private readonly embeddingRepository: EmbeddingRepository,
    private readonly embeddingProvider: EmbeddingProvider,
    @InjectPinoLogger(EmbeddingService.name)
    private readonly logger: PinoLogger,
  ) {}

  async embedChunk(params: GenerateChunkingEmbeddingParams): Promise<void> {
    const { tenantId, chunkId, content, model } = params;

    if (!content?.trim()) {
      this.logger.warn({ chunkId, tenantId }, 'Skipping Empty Content');
      return;
    }

    // Idempotency guard to prevent duplicate  provider calls
    const existing = await this.embeddingRepository.existsByChunkAndModel({
      tenantId,
      chunkId,
      model,
    });

    if (existing) {
      this.logger.debug(
        { tenantId, chunkId, model },
        'Embedding exists, skipping',
      );
      return;
    }

    try {
      const vector = await this.embeddingProvider.embed(content, model);

      if (!vector?.length) {
        throw new EmbeddingGenerationException(
          chunkId,
          new Error(
            'AI API execution suceeded but returned an empty vector payload',
          ),
        );
      }

      if (vector.some((v) => !Number.isFinite(v))) {
        throw new EmbeddingGenerationException(
          chunkId,
          new Error(
            'Vector Matrix payload corrupted: Contains non-finit NaN/Infinite values.',
          ),
        );
      }

      // Ensure the vector isn't a completely blank dead matrix array
      if (vector.every((v) => v === 0)) {
        throw new EmbeddingGenerationException(
          chunkId,
          new Error(
            'Vector matrix payload is dead: Contains only zero dimensions.',
          ),
        );
      }

      // Safe storage execution
      await this.embeddingRepository.upsert({
        tenantId,
        chunkId,
        model,
        embedding: vector,
      });

      this.logger.debug({ tenantId, chunkId, model }, 'Embedding Persisted');
    } catch (error) {
      this.logger.error(
        {
          tenantId,
          chunkId,
          model,
          err: error instanceof Error ? error.message : String(error),
        },
        'Embedding Generation Failed',
      );

      throw new EmbeddingGenerationException(chunkId, error as Error);
    }
  }
}
