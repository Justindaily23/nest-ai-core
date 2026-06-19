import { Injectable } from '@nestjs/common';
import { VectorRetrievalService } from '../services/vector-retrieval.service';
import type { RetrievalQuery } from '../../shared/types/retrieval-query.type';
import type { RetrievedContext } from '../../shared/types/retrieved-context.type';
import { QueryEmbeddingService } from '../services/query-embedding.service';
import { clampTop } from '../../shared/utils/clampTopK';

@Injectable()
export class VectorRetrieverAdapter {
  private readonly model = 'text-embedding-3-small';
  constructor(
    private readonly vectorService: VectorRetrievalService,
    private readonly queryEmbeddingService: QueryEmbeddingService,
  ) {}

  async retrieve(query: RetrievalQuery): Promise<RetrievedContext[]> {
    const embedding = await this.queryEmbeddingService.embed(query.query);
    const safeTopK = clampTop(query.topK);

    const results = await this.vectorService.retrieveFlat({
      tenantId: query.tenantId,
      model: this.model,
      queryEmbedding: embedding,
      topK: safeTopK,

      // TODO(filters): re-enable once FlatRetrievalParams supports filters AND
      // the ivfflat overfetch/iterative_scan decision is made (depends on confirming
      // pgvector version once the DB exists) — see prior thread re: filtered ANN recall.
      // filters: query.filters,
    });

    return results.map((r, index) => ({
      chunkId: r.chunkId,
      content: r.content,
      score: index + 1,
      source: {
        documentId: r.documentId,
        filename: r.filename,
      },
      signals: {
        vectorRank: index + 1,
        vectorSimilarity: r.score,
      },
    }));
  }
}
