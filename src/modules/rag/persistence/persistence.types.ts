import { ChunkRole } from '@/common/enums/chunk-role.enum';

export interface ChunkRow {
  id: string;
  tenant_id: string;
  source_id: string;
  role: ChunkRole;
  content: string;
  token_count: number;
  position: number;
  parent_chunk_id?: string | null;
  metadata?: Record<string, unknown> | null;
}
