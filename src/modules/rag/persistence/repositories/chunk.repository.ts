import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@/core/database/database.service';
import { CreateChunkParams } from '../interfaces/chunk-repository.interface';

@Injectable()
export class ChunkRepository {
  constructor(private readonly db: DatabaseService) {}

  async insertMany(chunks: CreateChunkParams[]): Promise<void> {
    if (chunks.length === 0) return;

    await this.db.client
      .insertInto('chunks')
      .values(
        chunks.map((chunk) => ({
          id: chunk.id,
          tenant_id: chunk.tenantId,
          source_id: chunk.sourceId,
          role: chunk.role,
          content: chunk.content,
          token_count: chunk.tokenCount,
          position: chunk.position,
          parent_chunk_id: chunk.parentChunkId ?? null,
          metadata: chunk.metadata ? JSON.stringify(chunk.metadata) : null,
        })),
      )
      .execute();
  }
}
