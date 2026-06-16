import { Injectable } from '@nestjs/common';
import { VectorRetrievalService } from '../services/vector-retrieval.service';
import { RetrievalQuery } from '../types/retrieval-query.type';
import { RetrievedContext } from '../types/retrieved-context.type';
import { QueryEmbeddingService } from '../services/query-embedding.service';

@Injectable()
export class VectorRetrieverAdapter {
  private readonly model = 'text-embedding-3-small';
  constructor(
    private readonly vectorService: VectorRetrievalService,
    private readonly queryEmbeddingService: QueryEmbeddingService,
  ) {}

  async retrieve(query: RetrievalQuery): Promise<RetrievedContext[]> {
    const embedding = await this.queryEmbeddingService.embed(query.query);

    const results = await this.vectorService.retrieveFlat({
      tenantId: query.tenantId,
      model: this.model,
      queryEmbedding: embedding,
      topK: query.topK,
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
        vectorScore: index + 1,
      },
    }));
  }
}
