import { ChunkingStrategy } from '../interfaces/chunking-strategy.interface';

export const DEFAULT_STRATEGY: ChunkingStrategy = {
  parentChunkSize: 1000,
  childChunkSize: 200,
  overlapSize: 20,
  parentOverlapSize: 100,
};
