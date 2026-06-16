import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { DatabaseService } from '@/core/database/database.service';
import {
  ChunkWithDocumentMetadata,
  CreateChunkParams,
  KeywordSearchParams,
  KeywordSearchResult,
} from './interfaces/chunk-repository.interface';
import { OperationalException } from '@/common/exceptions/operational.exception';
import { ChunkRole } from '@/common/enums/chunk-role.enum';
import { getSql } from '@/core/database/kysely/kysely-sql';

@Injectable()
export class ChunkRepository {
  constructor(
    private readonly db: DatabaseService,
    @InjectPinoLogger(ChunkRepository.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Atomically persists a batch of Parent and Child chunks for a single document.
   *
   * Design guarantees:
   *   - Verifies the parent document exists and belongs to the tenant before writing.
   *   - All chunks are written in a single transaction — partial writes cannot occur.
   *   - Upserts on ID conflict — safe for re-ingestion without duplicate rows.
   *   - Chunks are immutable by design; only content, token_count, position,
   *     and metadata are updated on conflict (no updated_at — chunks don't mutate).
   */
  async insertMany(chunks: CreateChunkParams[]): Promise<void> {
    // Nothing to persist; exit cleanly without touching the database.
    if (chunks.length === 0) return;

    // Pull context from the first chunk for structured logging and validation.
    // All chunks in a batch share the same tenantId and sourceId by contract.
    const { tenantId, sourceId } = chunks[0];

    try {
      await this.db.client.transaction().execute(async (trx) => {
        const sql = await getSql();
        // PARENT DOCUMENT VALIDATION ---
        // Verify the parent document exists and is scoped to this tenant
        // before writing any chunks. Prevents orphaned chunk records and
        // enforces the FK constraint at the application layer before hitting
        // the database constraint — giving us a clean error code to work with.
        const documentExists = await trx
          .selectFrom('documents')
          .select('id')
          .where('id', '=', sourceId)
          .where('tenant_id', '=', tenantId)
          .executeTakeFirst();

        if (!documentExists) {
          // Throw a structured domain error — not a raw string — so the
          // catch block can wrap it in OperationalException with full context.
          throw new OperationalException(
            'database',
            'CHUNK_PARENT_DOCUMENT_NOT_FOUND',
            'Parent document not found for tenant.',
            undefined,
            { sourceId, tenantId },
          );
        }

        // MAP CHUNK PARAMS TO DATABASE COLUMNS ---
        // Transform the domain params into the exact column shape Kysely expects.
        // metadata is serialised to JSON string — Kysely does not auto-serialise JSONB.
        // parentChunkId is null for Parent chunks, a hash string for Child chunks.
        const values = chunks.map((chunk) => ({
          id: chunk.id,
          tenant_id: chunk.tenantId,
          source_id: chunk.sourceId,
          role: chunk.role,
          content: chunk.content,
          token_count: chunk.tokenCount,
          position: chunk.position,
          parent_chunk_id: chunk.parentChunkId ?? null,
          metadata: chunk.metadata ? JSON.stringify(chunk.metadata) : null,
        }));

        // BATCH UPSERT ---
        // Insert all chunks in a single statement.
        // ON CONFLICT (id): re-ingesting the same document with the same strategy
        // produces the same deterministic IDs — upsert ensures idempotency instead
        // of a unique constraint violation crash.
        // EXCLUDED references the row that was rejected by the conflict —
        // i.e. the new incoming values we want to keep.
        await trx
          .insertInto('chunks')
          .values(values)
          .onConflict((oc) =>
            oc.columns(['id', 'tenant_id']).doUpdateSet({
              content: sql`EXCLUDED.content`,
              token_count: sql`EXCLUDED.token_count`,
              position: sql`EXCLUDED.position`,
              metadata: sql`EXCLUDED.metadata`,
            }),
          )
          .execute();
      });
    } catch (error) {
      // --- ERROR BOUNDARY ---
      // The transaction callback throws on any failure — Kysely automatically
      // rolls back the transaction before control reaches here, so no partial
      // writes can exist in the database at this point.
      //
      // If the error is already an OperationalException (e.g. document not found),
      // log it and rethrow as-is — it already carries the correct code and context.
      // Otherwise wrap the raw database error so no Kysely/pg internals leak upward.
      if (error instanceof OperationalException) {
        this.logger.error({
          tenantId,
          sourceId,
          chunkCount: chunks.length,
          code: error.code,
          err: error,
          msg: 'Chunk batch transaction aborted.',
        });
        throw error;
      }

      this.logger.error({
        tenantId,
        sourceId,
        chunkCount: chunks.length,
        err: error,
        msg: 'Transaction failed: Unable to batch insert chunks safely.',
      });

      throw new OperationalException(
        'database',
        'CHUNK_INSERT_FAILED',
        'Failed to persist chunk batch.',
        undefined,
        error,
      );
    }
  }

  async findByIds(
    tenantId: string,
    ids: string[],
  ): Promise<ChunkWithDocumentMetadata[]> {
    if (ids.length === 0) return [];

    return this.db.client
      .selectFrom('chunks')
      .innerJoin('documents', 'documents.id', 'chunks.source_id')

      .select([
        'chunks.id',
        'chunks.content',
        'chunks.source_id as documentId',
        'documents.filename',
      ])
      .where('chunks.tenant_id', '=', tenantId)
      .where('chunks.id', 'in', ids)
      .execute();
  }

  async findParentsWithChildren(
    tenantId: string,
    childChunkIds: string[],
  ): Promise<
    {
      parentId: string;
      parentContent: string;
      childId: string;
      childContent: string;
    }[]
  > {
    return this.db.client
      .selectFrom('chunks as child')
      .innerJoin('chunks as parent', 'parent.id', 'child.parent_chunk_id')
      .select([
        'parent.id as parentId',
        'parent.content as parentContent',
        'child.id as childId',
        'child.content as childContent',
      ])
      .where('child.tenant_id', '=', tenantId)
      .where('parent.tenant_id', '=', tenantId)
      .where('child.role', '=', ChunkRole.CHILD)
      .where('child.id', 'in', childChunkIds)
      .execute();
  }

  async keywordSearch(
    params: KeywordSearchParams,
  ): Promise<KeywordSearchResult[]> {
    const sql = await getSql();

    const { tenantId, query, limit } = params;

    return this.db.client
      .selectFrom('chunks')
      .innerJoin('documents', 'documents.id', 'chunks.source_id')
      .select([
        'chunks.id as chunkId',
        'chunks.content',
        'documents.id as documentId',
        'documents.filename',
      ])
      .where('chunks.tenant_id', '=', tenantId)
      .where('chunks.role', '=', ChunkRole.CHILD)
      .where(
        sql<boolean>`to_tsvector('english', chunks.content) @@ plainto_tsquery('english', ${query})`,
      )
      .orderBy(
        sql`ts_rank(to_tsvector('english', chunks.content), plainto_tsquery('english', ${query}))`,
        'desc',
      )
      .limit(limit)
      .execute();
  }
}
