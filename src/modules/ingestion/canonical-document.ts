/**
 * @file canonical-document.ts
 * @description INVARIANT ARCHITECTURAL BOUNDARY: The Core RAG Ingestion Contract.
 *
 * DESIGN PRINCIPLE (The "VLC Player" Pattern):
 * This file defines the universal intermediate representation (IR) for all documents entering the system.
 * Regardless of sector (Medical, Financial, Legal) or source layout (PDF, CSV, JSON, Markdown),
 * every specialized document parser (IngestionCodec) MUST parse its raw data into this exact canonical shape.
 *
 * WHY IS THIS IMMUTABLE (readonly)?
 * By enforcing deep compile-time immutability, we guarantee that once document structure and meaning
 * are extracted, downstream processes (Chunking, Vectorization, Database Writing) cannot mutate the text
 * or leak cross-tenant boundaries. This isolates parsing logic completely from AI providers and database states.
 *
 * RULES OF THE CONTRACT:
 * 1. DO NOT add vector/embedding properties here. This layer represents text and structure only.
 * 2. `sections` are layout-based divisions (e.g., a physical table or a full paragraph), NOT mathematical chunks.
 * 3. `metadata` fields must use structural primitives to allow predictable Postgres JSONB indexing later.
 */

export interface CanonicalDocument {
  /** The tenant context extracted from the identity/auth spine. Guarantees hard data isolation. */
  readonly tenantId: string;

  /** Stable identifier for the source (e.g., database UUID, file hash, or external system reference). */
  readonly sourceId: string;

  /** The standard internet media type format (e.g., 'application/pdf', 'text/markdown'). */
  readonly mimeType: string;

  /** Logical structural and textual sections extracted directly from the file layout. */
  readonly sections: CanonicalSection[];

  /** Domain-specific global metadata (e.g., patient_id for health, corporate_tax_id for finance). */
  readonly metadata: Record<string, unknown>;
}

export interface CanonicalSection {
  /** Deterministic unique hash generated from (sourceId + structuralPath + sequential index). */
  readonly sectionId: string;

  /** The absolute, un-truncated textual payload (e.g., full paragraph text or a serialized Markdown table). */
  readonly rawText: string;

  /** Optional nesting path identifying data location within the document (e.g., "discharge_summary.vitals"). */
  readonly structuralPath?: string;

  /** Tuple tracking physical layout location for PDFs: [start_page, end_page]. Used for exact UI rendering. */
  readonly pageRange?: readonly [number, number];

  /** Localized contextual overrides or extracted tabular schemas specific to this section. */
  readonly metadata?: Record<string, unknown>;
}
