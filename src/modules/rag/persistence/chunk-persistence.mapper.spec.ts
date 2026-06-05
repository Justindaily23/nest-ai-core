/**
 * @file chunk-persistence.mapper.spec.ts
 * @description Unit test suite confirming the invariant data mapping contract.
 * Ensures CanonicalChunks are correctly prepared as stable DB rows.
 */

import { mapChunksToRows } from '../persistence/chunk-persistence.mapper';
import { CanonicalChunk } from '../chunking/types/canonical-chunk';
import { ChunkRole } from '../../../common/enums/chunk-role.enum';

describe('Chunk Persistence Mapper', () => {
  it('maps canonical chunks to database rows correctly', () => {
    // 1. Arrange: Define the input standard shipping containers
    const chunks: CanonicalChunk[] = [
      {
        chunkId: 'parent-1',
        tenantId: 'tenant-1',
        sourceId: 'doc-1',
        role: ChunkRole.PARENT,
        content: 'Parent content',
        tokenCount: 120,
        position: 0,
        parentChunkId: null,
        metadata: { section: 'intro' },
      },
      {
        chunkId: 'child-1',
        tenantId: 'tenant-1',
        sourceId: 'doc-1',
        role: ChunkRole.CHILD,
        content: 'Child content',
        tokenCount: 45,
        position: 1,
        parentChunkId: 'parent-1',
        metadata: null,
      },
    ];

    // 2. Act: Run the pure, dependency-free transformation logic
    const rows = mapChunksToRows(chunks);

    // 3. Assert: Confirm snake_case structures and id field alignments match 1:1
    expect(rows).toEqual([
      {
        id: 'parent-1',
        tenant_id: 'tenant-1',
        source_id: 'doc-1',
        role: ChunkRole.PARENT,
        content: 'Parent content',
        token_count: 120,
        position: 0,
        parent_chunk_id: null,
        metadata: { section: 'intro' },
      },
      {
        id: 'child-1',
        tenant_id: 'tenant-1',
        source_id: 'doc-1',
        role: ChunkRole.CHILD,
        content: 'Child content',
        token_count: 45,
        position: 1,
        parent_chunk_id: 'parent-1',
        metadata: null,
      },
    ]);
  });
});
