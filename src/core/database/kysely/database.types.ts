import type { Generated, JSONColumnType } from 'kysely' with {
  'resolution-mode': 'import',
};
import type { ChunkRole } from '@common/enums/chunk-role.enum';
import type { DocumentStatus } from '@/modules/rag/persistence/repositories/interfaces/document-repository.interface';
/**
 * Core table tracking uploaded raw files (e.g., PDFs, Word docs, Slack exports).
 * Used primarily for administrative audits and global deduplication tracking.
 */
export interface DocumentsTable {
  id: string;
  tenant_id: string;
  source_type: string;
  filename: string | null;
  mime_type: string | null;
  checksum: string;
  status: Generated<DocumentStatus>;
  error_message: string | null;
  metadata: JSONColumnType<Record<string, unknown>> | null;
  created_at: Generated<Date>; // Database auto-assigns DEFAULT NOW() on entry. Optional on insert.
}

/**
 * Text processing table storing segments derived from parsed source documents.
 * Highly optimized for Retrieval-Augmented Generation (RAG) and semantic lookups.
 */
export interface ChunksTable {
  id: string;
  tenant_id: string;
  source_id: string;
  role: ChunkRole;
  content: string;
  token_count: number;
  position: number;
  parent_chunk_id: string | null;
  metadata: JSONColumnType<Record<string, unknown>> | null;
  created_at: Generated<Date>; // Database auto-assigns DEFAULT NOW() on entry. Optional on insert.
}

/**
 * Volatile mathematical coordinate matrix mapped to high-dimensional AI model outputs.
 * Designed to allow rapid vector deletions and easy hot-swaps when shifting model choices.
 */
export interface ChunkEmbeddingsTable {
  id: Generated<string>;
  tenant_id: string;
  chunk_id: string;
  model: string;
  embedding: unknown; // pgvector is opaque to TS
  created_at: Generated<Date>; // Database auto-assigns DEFAULT NOW() on entry. Optional on insert.
}

/**
 * The global database model mapping table handles directly into Kysely.
 * Guarantees compile-time safety and autocompletion routines across your entire application.
 */
export interface Database {
  documents: DocumentsTable;
  chunks: ChunksTable;
  chunk_embeddings: ChunkEmbeddingsTable;
}
