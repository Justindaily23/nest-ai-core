export type RetrievalQuery = {
  // Who owns the data being queried
  tenantId: string;

  // The raw user / syterm query
  query: string;

  //Optional retrieval size hint
  topK?: number;

  /**
   * Optional scope constraints.
   * These are NOT heuristics — they are authority / access limits.
   * QueryService must never discard these.
   */
  filters?: {
    documentIds?: string[];
    mimeTypes?: string[];
  };
};
