import { Injectable } from '@nestjs/common';
import { ChunkRepository } from '../../persistence/repositories/chunk.repository';
import { RetrievalQuery } from '../types/retrieval-query.type';
import { RetrievedContext } from '../types/retrieved-context.type';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';

@Injectable()
export class LexicalRetrievalService {
  constructor(
    private readonly chunkRepository: ChunkRepository,
    @InjectPinoLogger(LexicalRetrievalService.name)
    private readonly logger: PinoLogger,
  ) {}

  // Keyword search
  async retrieve(params: RetrievalQuery): Promise<RetrievedContext[]> {
    const { tenantId, query, topK } = params;

    // Guard against pathological topK values to protect latency footprints
    const safeTopK = Math.min(topK, 20);

    // Log the incoming asynchronous request
    this.logger.debug(
      { tenantId, query, safeTopK },
      'Starting lexical keyword search.....',
    );

    //Start time
    const startTime = Date.now();

    //Keyword search
    const results = await this.chunkRepository.keywordSearch({
      tenantId,
      query,
      limit: safeTopK,
    });

    // Log performance metrics for the async operation
    const duration = Date.now() - startTime;
    this.logger.info(
      { durationMs: duration, count: results.length },
      'Keyword search finished',
    );

    if (results.length === 0) {
      // Log a warning for empty results to catch potential indexing system errors
      this.logger.warn(
        { tenantId, query },
        'No chunks found for the given query',
      );
      return [];
    }

    //MAP TO CANONICAL SHAPE
    // score = rank position, NOT BM25 similarity score
    // Raw BM25 scores are incompatible with vector scores — rank is the only safe unit
    return results.map((r, index) => ({
      chunkId: r.chunkId,
      content: r.content,
      score: index + 1,
      source: {
        documentId: r.documentId,
        filename: r.filename ?? 'unknown',
      },
      signals: {
        lexicalScore: index + 1,
      },
    }));
  }
}
