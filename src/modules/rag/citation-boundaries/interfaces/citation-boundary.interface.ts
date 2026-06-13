/**
 * Represents a single citation-safe unit of context
 * One unit maps to exactly one source chunk
 */

export interface CitationUnit {
  citationId: string;
  content: string;
  tokens: number;
}

/**
 * Output citation boundary perocessing
 *
 */

export interface CitationBoundaryContext {
  units: CitationUnit[];
  totalTokens: number;
  citationMap: CitationIndexMap;
}

export interface CitationIndexMap {
  [shortId: string]: {
    parentChunkId: string;
    chunkId: string;
  };
}
