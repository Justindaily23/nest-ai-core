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
