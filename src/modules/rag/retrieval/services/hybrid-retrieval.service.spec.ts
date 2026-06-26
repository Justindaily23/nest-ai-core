import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { HybridRetrievalService } from './hybrid-retrieval.service';
import { VectorRetrieverAdapter } from '../adapters/vector-retriever.adapter';
import { LexicalRetrievalService } from './lexical-retrieval.service';

describe('HybridRetrievalService', () => {
  let service: HybridRetrievalService;

  let mockVectorAdapter: { retrieve: jest.Mock };
  let mockLexicalService: { retrieve: jest.Mock };
  let mockLogger: { error: jest.Mock; debug: jest.Mock; info: jest.Mock };

  const baseQuery = {
    tenantId: 'tenant-1',
    query: 'what is RAG?',
    topK: 10,
  };

  const makeResult = (
    chunkId: string,
    content = 'content',
    documentId = 'doc-1',
  ) => ({
    chunkId,
    content,
    score: 1,
    source: { documentId, filename: 'file.pdf' },
    signals: {},
  });

  beforeEach(async () => {
    mockVectorAdapter = { retrieve: jest.fn() };
    mockLexicalService = { retrieve: jest.fn() };
    mockLogger = { error: jest.fn(), debug: jest.fn(), info: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        HybridRetrievalService,
        { provide: VectorRetrieverAdapter, useValue: mockVectorAdapter },
        { provide: LexicalRetrievalService, useValue: mockLexicalService },
        {
          provide: getLoggerToken(HybridRetrievalService.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<HybridRetrievalService>(HybridRetrievalService);
  });

  afterEach(() => jest.clearAllMocks());

  // ----------------------------------------------------------------
  // Empty results
  // ----------------------------------------------------------------
  describe('empty results', () => {
    it('returns empty array when both retrievers return nothing', async () => {
      mockVectorAdapter.retrieve.mockResolvedValue([]);
      mockLexicalService.retrieve.mockResolvedValue([]);

      const results = await service.retrieve(baseQuery);

      expect(results).toEqual([]);
    });
  });

  // ----------------------------------------------------------------
  // Graceful degradation
  // ----------------------------------------------------------------
  describe('graceful degradation', () => {
    it('returns lexical results when vector retriever fails', async () => {
      mockVectorAdapter.retrieve.mockRejectedValue(new Error('vector timeout'));
      mockLexicalService.retrieve.mockResolvedValue([makeResult('chunk-1')]);

      const results = await service.retrieve(baseQuery);

      expect(results).toHaveLength(1);
      expect(results[0].chunkId).toBe('chunk-1');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('returns vector results when lexical retriever fails', async () => {
      mockVectorAdapter.retrieve.mockResolvedValue([makeResult('chunk-1')]);
      mockLexicalService.retrieve.mockRejectedValue(
        new Error('lexical timeout'),
      );

      const results = await service.retrieve(baseQuery);

      expect(results).toHaveLength(1);
      expect(results[0].chunkId).toBe('chunk-1');
      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('returns empty array when both retrievers fail', async () => {
      mockVectorAdapter.retrieve.mockRejectedValue(new Error('vector down'));
      mockLexicalService.retrieve.mockRejectedValue(new Error('lexical down'));

      const results = await service.retrieve(baseQuery);

      expect(results).toEqual([]);
      expect(mockLogger.error).toHaveBeenCalledTimes(2);
    });
  });

  // ----------------------------------------------------------------
  // RRF fusion
  // ----------------------------------------------------------------
  describe('RRF fusion', () => {
    it('accumulates RRF score from both retrievers for a shared chunk', async () => {
      mockVectorAdapter.retrieve.mockResolvedValue([makeResult('chunk-1')]);
      mockLexicalService.retrieve.mockResolvedValue([makeResult('chunk-1')]);

      const results = await service.retrieve(baseQuery);

      // chunk-1 appears in both at rank 1
      // RRF score = 1/(1+60) + 1/(1+60) = 2/61
      expect(results).toHaveLength(1);
      expect(results[0].score).toBeCloseTo(2 / 61, 6);
    });

    it('assigns partial RRF score when chunk appears in only one retriever', async () => {
      mockVectorAdapter.retrieve.mockResolvedValue([makeResult('chunk-1')]);
      mockLexicalService.retrieve.mockResolvedValue([makeResult('chunk-2')]);

      const results = await service.retrieve(baseQuery);

      // Both at rank 1 in their respective retrievers — equal scores
      expect(results[0].score).toBeCloseTo(1 / 61, 6);
      expect(results[1].score).toBeCloseTo(1 / 61, 6);
    });

    it('ranks shared chunks higher than exclusive chunks', async () => {
      mockVectorAdapter.retrieve.mockResolvedValue([
        makeResult('shared'),
        makeResult('vector-only'),
      ]);
      mockLexicalService.retrieve.mockResolvedValue([
        makeResult('shared'),
        makeResult('lexical-only'),
      ]);

      const results = await service.retrieve(baseQuery);

      expect(results[0].chunkId).toBe('shared');
    });

    it('records vectorRank and lexicalRank in signals for shared chunks', async () => {
      mockVectorAdapter.retrieve.mockResolvedValue([makeResult('chunk-1')]);
      mockLexicalService.retrieve.mockResolvedValue([makeResult('chunk-1')]);

      const results = await service.retrieve(baseQuery);

      expect(results[0].signals.vectorRank).toBe(1);
      expect(results[0].signals.lexicalRank).toBe(1);
    });

    it('only sets vectorRank when chunk appears in vector results only', async () => {
      mockVectorAdapter.retrieve.mockResolvedValue([makeResult('chunk-1')]);
      mockLexicalService.retrieve.mockResolvedValue([]);

      const results = await service.retrieve(baseQuery);

      expect(results[0].signals.vectorRank).toBe(1);
      expect(results[0].signals.lexicalRank).toBeUndefined();
    });

    it('only sets lexicalRank when chunk appears in lexical results only', async () => {
      mockVectorAdapter.retrieve.mockResolvedValue([]);
      mockLexicalService.retrieve.mockResolvedValue([makeResult('chunk-1')]);

      const results = await service.retrieve(baseQuery);

      expect(results[0].signals.lexicalRank).toBe(1);
      expect(results[0].signals.vectorRank).toBeUndefined();
    });

    it('deduplicates chunks appearing in both retrievers', async () => {
      mockVectorAdapter.retrieve.mockResolvedValue([makeResult('chunk-1')]);
      mockLexicalService.retrieve.mockResolvedValue([makeResult('chunk-1')]);

      const results = await service.retrieve(baseQuery);

      expect(results).toHaveLength(1);
    });

    it('sorts results by RRF score descending', async () => {
      // chunk-1 appears in both (higher score), chunk-2 only in vector
      mockVectorAdapter.retrieve.mockResolvedValue([
        makeResult('chunk-1'),
        makeResult('chunk-2'),
      ]);
      mockLexicalService.retrieve.mockResolvedValue([makeResult('chunk-1')]);

      const results = await service.retrieve(baseQuery);

      expect(results[0].chunkId).toBe('chunk-1');
      expect(results[0].score).toBeGreaterThan(results[1].score);
    });
  });

  // ----------------------------------------------------------------
  // topK slicing
  // ----------------------------------------------------------------
  describe('topK slicing', () => {
    it('slices output to topK after fusion', async () => {
      const manyResults = Array.from({ length: 15 }, (_, i) =>
        makeResult(`chunk-${i}`),
      );

      mockVectorAdapter.retrieve.mockResolvedValue(manyResults);
      mockLexicalService.retrieve.mockResolvedValue([]);

      const results = await service.retrieve({ ...baseQuery, topK: 5 });

      expect(results).toHaveLength(5);
    });

    it('clamps topK to MAX before slicing', async () => {
      const manyResults = Array.from({ length: 25 }, (_, i) =>
        makeResult(`chunk-${i}`),
      );

      mockVectorAdapter.retrieve.mockResolvedValue(manyResults);
      mockLexicalService.retrieve.mockResolvedValue([]);

      const results = await service.retrieve({ ...baseQuery, topK: 999 });

      expect(results.length).toBeLessThanOrEqual(20);
    });
  });
});
