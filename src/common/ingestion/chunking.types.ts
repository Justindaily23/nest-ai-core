/**
 * @file chunking-strategy.interface.ts
 * @description ARCHITECTURAL PARAMETER MATRIX: Configuration boundaries for the text slicing engine.
 *
 * DESIGN PRINCIPLE:
 * This interface defines the numerical constraints used by the chunking utilities to map
 * a continuous text stream into discrete token windows. It isolates token budgeting parameters
 * from the underlying parsing loop, making the layout engine highly flexible.
 *
 * CORE INVARIANTS:
 * - `parentSize` must be significantly larger than `childSize` (typically ~800-1200 tokens).
 * - `childSize` must fit cleanly inside the target vector space requirements (typically ~150-300 tokens).
 * - `overlapSize` must protect semantic context across window boundaries (typically 10-20% of child size).
 */

export interface ChunkingStrategy {
  /** The maximum mathematical token size of a PARENT context window block. */
  readonly parentSize: number;

  /** The maximum mathematical token size of a CHILD vector target block. */
  readonly childSize: number;

  /** The number of overlapping tokens shared between consecutive windows to prevent contextual cutting. */
  readonly overlapSize: number;
}
