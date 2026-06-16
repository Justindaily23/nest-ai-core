import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/core/database/database.service';
import {
  VectorSearchParams,
  VectorSearchResult,
} from '../interfaces/retrieval-repository.interface';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { OperationalException } from '@/common/exceptions/operational.exception';
import { getSql } from '@/core/database/kysely/kysely-sql';

@Injectable()
export class RetrievalRepository {
  /**
   * Dependency Injection- Pulls in our core database wrapper and a structured logger.
   * Repositories act strictly as persistence adapters, no business narrative logic lives here for clean separation of concerns.
   */
  constructor(
    private readonly db: DatabaseService,
    @InjectPinoLogger(RetrievalRepository.name)
    private readonly logger: PinoLogger,
  ) {}

  /**
   * Executes a highn speed vector similarity search using the native pgvector extension.
   * This is a readonly projection method designed for raw mathematical evaluation.
   */
  async search(params: VectorSearchParams): Promise<VectorSearchResult[]> {
    const sql = await getSql();
    // Blast-Radius Defensive Guard Rail
    // If an upstream service or API failure passes an empty array, stop immediately.
    // This protects the database connection pool from executing mathematically invalid queries.
    if (params.queryEmbedding.length === 0) {
      throw new OperationalException(
        'validation',
        'EMPTY_QUERY_VECTOR',
        'Query embedding vector cannot be empty.',
      );
    }

    // Serialization and Data Type Conversion
    // JavaScript float arrays are formatted into a standard bracketed, comma-separated string literal.
    // Kysely compiles the raw text block placeholder explicitly into a native PostgreSQL vector typecast.
    /// implemented like this every where in the codebase, consistent with the idea of having a single source of truth for how data is represented and handled in our system.
    const vectorLiteral = `[${params.queryEmbedding.join(',')}]`;
    const queryVector = sql`${vectorLiteral}::vector`;

    try {
      //Database Proximity Scan Execution
      const rows = await this.db.client
        .selectFrom('chunk_embeddings')
        .select([
          // Internal chunk ID is requested to act as the logical hydration handle for downstream layers
          'chunk_id as chunkId',

          // pgvector Cosine Distance operator (<=>) evaluates how opposite two meanings are (0 to 2).
          // We subtract distance from 1 to yield a human-readable similarity score (higher = closer match).
          sql<number>`1 - (embedding <=> ${queryVector})`.as('score'),
        ])
        //  Multitenant Security Boundary Check
        .where('tenant_id', '=', params.tenantId)
        // AI Engine Consistency Check
        .where('model', '=', params.model)

        // Query Optimization Hint:
        // Ordering explicitly by the raw vector distance matches the structural definition
        // of our physical DB index, allowing PostgreSQL to perform an optimized index-driven sweep.
        .orderBy(sql`embedding <=> ${queryVector}`)
        // Crop the result collection down to our chosen top-K sample budget
        .limit(params.topK)
        .execute();

      // Return the ordered array of matched chunk entries and similarity scores
      return rows.map((row) => ({
        chunkId: row.chunkId,
        score: Number(row.score),
      }));
    } catch (error) {
      // Infrastructure Error Isolation & Context Capture
      // Write a highly specific telemetry entry into our system logs for operations visibility.
      // We dump structural context parameters without leaking any actual query payloads.
      this.logger.error({
        tenantId: params.tenantId,
        model: params.model,
        topK: params.topK,
        err: error,
        msg: 'Vector similarity search failed.',
      });

      // Wrap the infrastructure-specific crash safely inside a domain-driven OperationalException.
      // This prevents deep database engine or network internals from leaking into the transport boundary.
      throw new OperationalException(
        'database',
        'VECTOR_SEARCH_FAILED',
        'Failed to perform vector similarity search.',
        undefined,
        error,
      );
    }
  }
}
