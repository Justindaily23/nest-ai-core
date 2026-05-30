/**
 * @file chunking-result.interface.ts
 * @description Operational output contract for the document slicing engine.
 */

import { ParentChunk } from './parent-chunk.type';
import { ChildChunk } from './child-chunk.type';

export interface ChunkingResult {
  /** Ordered array of parent context windows (~800-1200 tokens). */
  readonly parents: ParentChunk[];

  /** High-precision child slices (~150-300 tokens) mapped directly to parents. */
  readonly children: ChildChunk[];
}
