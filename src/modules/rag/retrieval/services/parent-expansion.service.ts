import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RetrievedContext } from '../../shared/types/retrieved-context.type';
import { ParentExpandedChunk } from '../interfaces/retrieval-repository.interface';
import { ChunkRepository } from '../../persistence/repositories/chunk.repository';

@Injectable()
export class ParentExpansionService {
  constructor(
    private readonly chunkRepository: ChunkRepository,
    @InjectPinoLogger(ParentExpansionService.name)
    private readonly logger: PinoLogger,
  ) {}

  async expand(
    results: RetrievedContext[],
    tenantId: string,
  ): Promise<ParentExpandedChunk[]> {
    if (!results.length) return [];

    const scoreMap = new Map(results.map((r) => [r.chunkId, r.score]));

    // 1. Bulk fetch child chunks — single query
    const chunkIds = results.map((r) => r.chunkId);
    const chunks = await this.chunkRepository.findByIds(tenantId, chunkIds);

    if (!chunks.length) {
      this.logger.warn(
        { tenantId, chunkIds },
        'Parent expansion: no chunks found for retrieved IDs',
      );
      return [];
    }

    // 2. Collect unique parent IDs from child rows
    const parentIds = [
      ...new Set(
        chunks
          .map((c) => c.parentChunkId)
          .filter((id): id is string => id !== null),
      ),
    ];

    // 3. Bulk fetch parent chunks — single query
    const parentChunks = await this.chunkRepository.findByIds(
      tenantId,
      parentIds,
    );
    const parentContentMap = new Map(
      parentChunks.map((p) => [p.id, p.content]),
    );

    // 4. Group children under their parent — pure in-memory
    const parentMap = new Map<string, ParentExpandedChunk>();

    for (const chunk of chunks) {
      if (!chunk.parentChunkId) continue;

      const parentContent = parentContentMap.get(chunk.parentChunkId);

      if (!parentContent) {
        this.logger.warn(
          { tenantId, parentChunkId: chunk.parentChunkId },
          'Parent content not found — skipping child',
        );
        continue;
      }

      if (!parentMap.has(chunk.parentChunkId)) {
        parentMap.set(chunk.parentChunkId, {
          parentChunkId: chunk.parentChunkId,
          parentContent,
          children: [],
          score: 0,
        });
      }

      const entry = parentMap.get(chunk.parentChunkId)!;
      const childScore = scoreMap.get(chunk.id) ?? 0;

      entry.children.push({
        chunkId: chunk.id,
        content: chunk.content,
        score: childScore,
      });

      // Parent score rises to match its highest-scoring child
      entry.score = Math.max(entry.score, childScore);
    }

    // Sort by score descending so ContextAssemblyService fills
    // the token budget with the most relevant blocks first
    return [...parentMap.values()].sort((a, b) => b.score - a.score);
  }
}
