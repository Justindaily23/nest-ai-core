/**
 * @file chunk-role.enum.ts
 * @description SYSTEM DISCRIMINATOR: Structural roles for text segments within the database.
 */
export enum ChunkRole {
  /** Large, cohesive context block (~800-1200 tokens). Retrieved for LLM generation but never embedded. */
  PARENT = 'PARENT',

  /** Small, high-precision text slice (~150-300 tokens). Embedded for mathematical vector lookups. */
  CHILD = 'CHILD',
}
