export class EmbeddingGenerationException extends Error {
  constructor(
    public readonly chunkId: string,
    cause: Error,
  ) {
    super(`Embedding generation failed for chunk: ${chunkId}`);
    this.name = 'EmbeddingGenerationException';
    this.cause = cause;
  }
}
