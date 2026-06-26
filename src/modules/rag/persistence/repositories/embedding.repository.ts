import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@core/database/database.service';
import {
  CreateEmbeddingParams,
  EmbeddingExistenceParams,
} from './interfaces/embedding-repository.interface';
import { getSql } from '@/core/database/kysely/kysely-sql';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DatabaseStorageException } from '../exceptions/database-storage.exception';

@Injectable()
export class EmbeddingRepository {
  constructor(
    private readonly db: DatabaseService,
    @InjectPinoLogger(EmbeddingRepository.name)
    private readonly logger: PinoLogger,
  ) {}

  async upsert(params: CreateEmbeddingParams): Promise<void> {
    const sql = await getSql();
    /**
     * Guard: empty vectors produce silent pgvector errors and waste a DB round-trip.
     *  Fail immediately with a structured code so ingestion bugs surface at the source.
     */
    if (!params.embedding || params.embedding.length === 0) {
      throw new DatabaseStorageException(
        'database', // Classified as a structural input block
        'EMPTY_EMBEDDING_VECTOR',
        `Embedding vector cannot be empty for chunk: ${params.chunkId}`,
        { chunkId: params.chunkId, model: params.model },
      );
    }

    /**
     *  Single string literal bind parameter — avoids per-dimension SQL interpolation
     *  that bloats query strings and stresses the pg wire protocol at scale.
     */
    const vectorLiteral = `[${params.embedding.join(',')}]`;
    const vectorSql = sql`${vectorLiteral}::vector`;

    try {
      await this.db.client
        .insertInto('chunk_embeddings')
        .values({
          tenant_id: params.tenantId,
          chunk_id: params.chunkId,
          model: params.model,
          embedding: vectorSql,
        })
        .onConflict((oc) =>
          oc.columns(['tenant_id', 'chunk_id', 'model']).doUpdateSet({
            embedding: vectorSql,
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
      throw new DatabaseStorageException(
        'database',
        'EMBEDDING_UPSERT_FAILED',
        'Failed to persist embedding vector.',
        error,
      );
    }
  }

  async existsByChunkAndModel(
    params: EmbeddingExistenceParams,
  ): Promise<boolean> {
    const sql = await getSql();
    try {
      const result = await this.db.client
        .selectFrom('chunk_embeddings')
        .select(sql`1`.as('exists'))
        .where('tenant_id', '=', params.tenantId)
        .where('chunk_id', '=', params.chunkId)
        .where('model', '=', params.model)
        .limit(1)
        .executeTakeFirst();

      return !!result;
    } catch (error) {
      this.logger.error({
        tenantId: params.tenantId,
        chunkId: params.chunkId,
        model: params.model,
        err: error,
        msg: 'Failed to check embedding existence.',
      });

      throw new DatabaseStorageException(
        'database',
        'EMBEDDING_EXISTENCE_CHECK_FAILED',
        `Failed to verify existence profile for chunk: ${params.chunkId}`,
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
      throw new DatabaseStorageException(
        'database',
        'EMBEDDING_DELETE_BY_CHUNK_FAILED',
        `Failed to delete embedding vectors for chunk: ${chunkId}`,
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
      throw new DatabaseStorageException(
        'database',
        'EMBEDDING_DELETE_BY_MODEL_FAILED',
        `Failed to delete embedding vectors for model: ${model}`,
        error,
      );
    }
  }
}
