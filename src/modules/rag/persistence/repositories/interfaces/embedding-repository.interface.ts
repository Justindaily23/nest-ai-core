/**
 * Minimal parameters required to persist a vector embedding.
 * Excludes metadata, token counts, and text to enforce strict
 * separation between storage and domain logic.
 */
export interface CreateEmbeddingParams {
  /** Target tenant for multi-tenant data isolation. */
  tenantId: string;
  /** Foreign key referencing the source text snippet in the chunks table. */
  chunkId: string;
  /** The specific model name used to generate the vector (defines the coordinate system). */
  model: string;
  /** Raw floating-point array representing the mathematical vector projection. */
  embedding: number[];
}

// embeddings/interfaces/embedding-repository.interface.ts
export interface EmbeddingExistenceParams {
  tenantId: string;
  chunkId: string;
  model: string;
}
