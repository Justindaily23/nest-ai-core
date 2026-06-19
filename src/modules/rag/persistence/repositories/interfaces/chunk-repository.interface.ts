import { ChunkRole } from '@common/enums/chunk-role.enum';

export interface CreateChunkParams {
  id: string;
  tenantId: string;
  sourceId: string; // documents.id
  role: ChunkRole;
  content: string;
  tokenCount: number;
  position: number;
  parentChunkId?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface KeywordSearchParams {
  tenantId: string;
  query: string;
  limit: number;
  filters?: {
    documentIds?: string[];
    mimeTypes?: string[];
  };
}

export interface KeywordSearchResult {
  chunkId: string;
  content: string;
  documentId: string;
  filename: string | null;
}

export interface ChunkWithDocumentMetadata {
  id: string;
  content: string;
  parentChunkId: string | null;
  documentId: string;
  filename: string | null;
}
