/**
 * @file canonical-chunk.ts
 * @description INVARIANT PROCESSING BOUNDARY: The Post-Split Vector Storage Payload.
 *
 * DESIGN PRINCIPLE (Parent-Child Optimization):
 * This interface represents the immutable data packet yielded by the chunking engine.
 * It maps structural document sections into deterministic, searchable database fragments.
 * - PARENT Chunks: Large contextual units (~800–1200 tokens) that maintain narrative flow.
 * - CHILD Chunks: Dense mathematical targets (~150–300 tokens) optimized for vector matching.
 *
 * COMPLIANCE & RECONSTRUCTION:
 * - `position` allows sorting fragments chronologically to preserve the document's original flow.
 * - All properties are `readonly` to block down-stream mutation during the asynchronous vectorization loop.
 */

import { ChunkRole } from '@/common/enums/chunk-role.enum';

export interface CanonicalChunk {
  /** Deterministic tracking hash generated from (tenantId + sourceId + role + position). */
  readonly chunkId: string;

  /** Multi-tenant isolation anchor. Absolutely mandatory for database query boundaries. */
  readonly tenantId: string;

  /** References the parent CanonicalDocument's unique sourceId identifier. */
  readonly sourceId: string;

  /** Discriminator mapping the chunk's structural responsibility (PARENT context vs CHILD vector). */
  readonly role: ChunkRole;

  /** The raw, un-truncated string content (can be freeform prose or a serialized markdown table). */
  readonly content: string;

  /** The precise mathematical token weight of the content, calculated using the tiktoken library. */
  readonly tokenCount: number;

  /** The sequential zero-based index of this fragment within its respective file hierarchy. */
  readonly position: number;

  /** Self-referencing structural link. If this is a CHILD chunk, this MUST point to its PARENT chunkId. */
  readonly parentChunkId?: string | null;

  /** Dynamic field-level tracking data (e.g., page numbers, table headers, or industry markers). */
  readonly metadata?: Record<string, unknown> | null;
}
