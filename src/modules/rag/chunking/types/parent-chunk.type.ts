/**
 * @file parent-chunk.type.ts
 * @description INVARIANT LOGICAL BOUNDARY: The Core Context Window Payload.
 */
export interface ParentChunk {
  /** Stable deterministic hash generated from (tenantId + sourceId + 'parent' + startTokenOffset). */
  readonly id: string;

  /** The multi-tenant security anchor. Mandatory for data isolation. */
  readonly tenantId: string;

  /** References the unique parent CanonicalDocument sourceId tracker. */
  readonly documentId: string;

  /** The chronological index of this unit within the file hierarchy canvas. */
  readonly sequence: number;

  /** The comprehensive, un-truncated narrative text context payload. */
  readonly content: string;

  /** The precise mathematical token weight of the parent block. */
  readonly tokenCount: number;

  /** Open JSON map for layout tracking, source highlighting, and sector variables. */
  readonly metadata: Record<string, unknown>; // Unified with ChildChunk
}
