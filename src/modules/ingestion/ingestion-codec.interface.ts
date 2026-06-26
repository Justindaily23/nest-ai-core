/**
 * @file ingestion-codec.interface.ts
 * @description ARCHITECTURAL ABSTRACT WRAPPER: The Layout-Aware Codec Contract.
 *
 * DESIGN PRINCIPLE (The "Pluggable Parser" Pattern):
 * This interface defines the contract for all physical file parsers within the system.
 * Every unique file layout or industry vertical (e.g., Medical EHRs, Financial CSVs,
 * Markdown manuals) must implement this interface as a standalone, decoupled class.
 *
 * THE PURITY INVARIANT:
 * Codecs are strictly processing units responsible for turning raw binary streams
 * into a structured intermediate representation (CanonicalDocument). They do not manage
 * state, database connections, background worker queues, or external AI providers.
 *
 * VIOLATION ALERT FOR MAINTAINERS:
 * - NEVER perform text chunking or mathematical token slicing within this layer.
 * - NEVER generate vector embeddings or make remote HTTP calls to LLM APIs here.
 * - NEVER save tracking rows or modify application state from inside an extraction execution loop.
 */

import { IngestionInput } from './ingestion-input';
import { CanonicalDocument } from './canonical-document';

export interface IngestionCodec {
  /**
   * Evaluates the data envelope to quickly determine if this specific parser
   * can extract information from the file.
   *
   * CRITICAL: Must be synchronous, pure, and fast. It should only evaluate
   * file extensions, mimeTypes, or declarative domain hints.
   */
  supports(input: IngestionInput): boolean;

  /**
   * Parses the file layout and yields the invariant CanonicalDocument structure.
   *
   * CRITICAL: This is an un-chunked layout processor. It reads structural paths,
   * isolates tables from narrative text, and maps them directly to the domain.
   */
  extract(input: IngestionInput): Promise<CanonicalDocument>;
}
