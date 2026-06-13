export const EMBEDDING_PROVIDER_TOKEN = 'EMBEDDING_PROVIDER_TOKEN';

/**
 * Translates a raw string slice into an array of floats.
 * @param content Raw human text payload.
 * @param model Target deployment model string coordinate.
 */

export abstract class EmbeddingProvider {
  abstract embed(content: string, model: string): Promise<number[]>;
}
