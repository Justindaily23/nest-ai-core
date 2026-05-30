/**
 * @file ingestion-input.interface.ts
 * @description DATA SYSTEM BOUNDARY: The Unified Ingestion Envelope.
 *
 * DESIGN PRINCIPLE:
 * This interface represents the untrusted, raw data boundary entering the ingestion pipeline.
 * It encapsulates the binary payload along with all surrounding network and file-level metadata
 * required by the `IngestionRouter` to select and execute the appropriate extraction codec.
 *
 * IMMUTABILITY GUARANTEE:
 * Marked entirely as `readonly` to enforce a strict pass-by-reference integrity constraint
 * across asynchronous worker boundaries and multi-threaded environments (like BullMQ jobs).
 * The buffer contents and associated tracking keys must remain identical from the HTTP
 * controller layer all the way to the layout extraction layer.
 */

export interface IngestionInput {
  /** The tenant context extracted from the identity spine. Enforces immediate data boundary isolation. */
  readonly tenantId: string;

  /** The original user-provided or system-provided name of the resource (e.g., 'patient_discharge_summary.pdf'). */
  readonly filename: string;

  /** The verified network media type (e.g., 'application/pdf', 'text/csv') used for core router mapping. */
  readonly mimeType: string;

  /** The immutable raw binary memory stream of the file asset awaiting layout processing. */
  readonly buffer: Buffer;

  /**
   * Declarative execution hints passed down from the client API layer.
   * Allows overriding automated routing rules when processing ambiguous hybrid documents.
   */
  readonly hints?: {
    /** High-level industry sector categorization to prioritize domain-specific layout rules. */
    readonly domain?: 'medical' | 'financial' | 'generic';

    /** Specific named parsing strategy target (e.g., 'ocr-forced', 'native-text-only'). */
    readonly layoutStrategy?: string;
  };
}
