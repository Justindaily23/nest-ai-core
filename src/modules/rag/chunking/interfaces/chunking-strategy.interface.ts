/**
 * @file chunking-strategy.interface.ts
 * @description Parameter rules for the parent-child token window slicing loops.
 */
export interface ChunkingStrategy {
  /** Maximum token size of a PARENT context window block (~800-1200 tokens). */
  readonly parentChunkSize: number;

  /** Maximum token size of a CHILD vector search target block (~150-300 tokens). */
  readonly childChunkSize: number;

  /** Number of overlapping tokens between parent blocks to eliminate boundary blind spots. */
  readonly parentOverlapSize: number;

  /** Number of overlapping tokens between child slices to safeguard boundary context. */
  readonly overlapSize: number;
}
