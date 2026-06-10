export interface VectorSearchParams {
  tenantId: string;
  model: string;
  queryEmbedding: number[];
  topK: number;
}

export interface VectorSearchResult {
  chunkId: string;
  score: number; //  The similarity score between the query embedding and the chunk embedding(higher is more similar)
}

export interface FlatRetrievalParams {
  tenantId: string;
  model: string;
  queryEmbedding: number[];
  topK: number;
  /**
   * Optional similarity score cutoff threshold.
   * @default 0.0 (Returns raw vector slice without semantic pruning)
   * Recommended production baseline for text-embedding-3-small: 0.7
   */
  minScore?: number;
}

export interface RetrievedChunk {
  chunkId: string;
  content: string;
  score: number;
}

export interface ChildMatch {
  chunkId: string;
  parentChunkId: string;
  content: string;
  score: number;
}

export interface ParentExpandedChunk {
  parentChunkId: string;
  parentContent: string;
  children: Array<{
    chunkId: string;
    content: string;
    score: number;
  }>;
  score: number; // best child score
}
