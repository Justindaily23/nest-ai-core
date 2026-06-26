/**
 * @file child-chunk.type.ts
 * @description INVARIANT SEARCH BOUNDARY: The High-Precision Vector Target.
 */
export interface ChildChunk {
  /** Stable deterministic hash generated from (tenantId + sourceId + 'child' + absoluteChildStart). */
  readonly id: string;

  /** Foreign key pointing directly to the unique identifier of the containing ParentChunk. */
  readonly parentId: string;

  /** The multi-tenant security anchor. Hard boundary parameter. */
  readonly tenantId: string;

  /** References the unique parent CanonicalDocument sourceId tracker. */
  readonly documentId: string;

  /** The sequential zero-based monotonic index of this child slice across the document. */
  readonly sequence: number;

  /** The specific text slice encapsulated by this token window, including boundary overlaps. */
  readonly content: string;

  /** The exact mathematical token weight of this slice. */
  readonly tokenCount: number;

  /** Operational tracking matrices for document reconstruction and source highlighting. */
  readonly metadata: Record<string, unknown>;
}
