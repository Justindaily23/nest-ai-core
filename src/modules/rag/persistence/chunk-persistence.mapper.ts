/**
 * @file chunk-persistence.mapper.ts
 * @description Pure data transformation layer converting CanonicalChunks into DB-ready layouts.
 * Zero side-effects, zero external dependencies, 100% testable.
 */

import { CanonicalChunk } from '@modules/rag/chunking/types/canonical-chunk';
import { ChunkRow } from './persistence.types';

export function mapChunksToRows(chunks: CanonicalChunk[]): ChunkRow[] {
  return chunks.map((chunk) => ({
    id: chunk.chunkId,
    tenant_id: chunk.tenantId,
    source_id: chunk.sourceId,
    role: chunk.role,
    content: chunk.content,
    token_count: chunk.tokenCount,
    position: chunk.position,
    parent_chunk_id: chunk.parentChunkId,
    metadata: chunk.metadata,
  }));
}
