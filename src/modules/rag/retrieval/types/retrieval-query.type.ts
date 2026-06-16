/**
 * Immutable retrieval input passed from execution layer.
 * This type MUST remain stable across versions.
 */
export type RetrievalQuery = {
  tenantId: string;
  query: string;
  topK: number;
  filters?: {
    documentIds?: string[];
    mimeTypes?: string[];
  };
};
