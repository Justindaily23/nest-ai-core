import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@core/database/database.service';
import { CreateEmbeddingParams } from './interfaces/embedding-repository.interface';
import { sql } from 'kysely';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { OperationalException } from '@/common/exceptions/operational.exception';

@Injectable()
export class EmbeddingRepository {
  constructor(
    private readonly db: DatabaseService,
    @InjectPinoLogger(EmbeddingRepository.name)
    private readonly logger: PinoLogger,
  ) {}

  async upsert(params: CreateEmbeddingParams): Promise<void> {
    // pgvector expects single string literal. We convert the number array into a string format that can be cast to vector in SQL.
    // standard text representation that postgres expects for vector types
    const vectorLiteral = `[${params.embedding.join(',')}]`;

    try {
      await this.db.client
        .insertInto('chunk_embeddings')
        .values({
          tenant_id: params.tenantId,
          chunk_id: params.chunkId,
          model: params.model,
          embedding: sql`${vectorLiteral}::vector`,
        })
        .onConflict((oc) =>
          oc.columns(['chunk_id', 'model']).doUpdateSet({
            embedding: sql`${vectorLiteral}::vector`,
            created_at: sql`NOW()`,
          }),
        )
        .execute();
    } catch (error) {
      this.logger.error({
        tenantId: params.tenantId,
        chunkId: params.chunkId,
        model: params.model,
        err: error,
        msg: 'Failed to upsert embedding vector.',
      });
      throw new OperationalException(
        'database',
        'EMBEDDING_UPSERT_FAILED',
        'Failed to persist embedding vector.',
        undefined, // no HTTP status — this is infrastructure, not HTTP
        error,
      );
    }
  }

  async deleteByChunkId(tenantId: string, chunkId: string): Promise<void> {
    try {
      await this.db.client
        .deleteFrom('chunk_embeddings')
        .where('tenant_id', '=', tenantId)
        .where('chunk_id', '=', chunkId)
        .execute();
    } catch (error) {
      this.logger.error({
        tenantId,
        chunkId,
        err: error,
        msg: 'Failed to delete embeddings by chunkId.',
      });
      throw new OperationalException(
        'database',
        'EMBEDDING_DELETE_BY_CHUNK_FAILED',
        'Failed to delete embedding vectors for chunk.',
        undefined,
        error,
      );
    }
  }

  async deleteByModel(tenantId: string, model: string): Promise<void> {
    try {
      await this.db.client
        .deleteFrom('chunk_embeddings')
        .where('tenant_id', '=', tenantId)
        .where('model', '=', model)
        .execute();
    } catch (error) {
      this.logger.error({
        tenantId,
        model,
        err: error,
        msg: 'Failed to delete embeddings by model.',
      });
      throw new OperationalException(
        'database',
        'EMBEDDING_DELETE_BY_MODEL_FAILED',
        'Failed to delete embedding vectors for model.',
        undefined,
        error,
      );
    }
  }
}
