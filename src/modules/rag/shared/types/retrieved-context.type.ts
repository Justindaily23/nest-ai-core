export type RetrievedContext = {
  chunkId: string;
  content: string;

  /**
   * Primary ranking signal for this result. Meaning depends on strategy:
   * - vector-only / lexical-only: 1-based rank (1 = best, lower is better)
   * - hybrid: RRF fused score (higher is better)
   * Never compare `score` across different strategies — unit and
   * direction both differ.
   */
  score: number;

  source: {
    documentId: string;
    filename: string;
    page?: number;
  };

  signals: {
    vectorRank?: number;
    lexicalRank?: number;
    vectorSimilarity?: number;
  };
};
