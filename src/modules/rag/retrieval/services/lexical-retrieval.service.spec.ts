import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { LexicalRetrievalService } from './lexical-retrieval.service';
import { ChunkRepository } from '../../persistence/repositories/chunk.repository';

describe('LexicalRetrievalService', () => {
  let service: LexicalRetrievalService;

  let mockChunkRepository: { keywordSearch: jest.Mock };
  let mockLogger: {
    debug: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };

  const baseQuery = {
    tenantId: 'tenant-1',
    query: 'what is RAG?',
    topK: 10,
  };

  const mockSearchResults = [
    {
      chunkId: 'chunk-1',
      content: 'first result',
      documentId: 'doc-1',
      filename: 'file1.pdf',
    },
    {
      chunkId: 'chunk-2',
      content: 'second result',
      documentId: 'doc-2',
      filename: 'file2.pdf',
    },
    {
      chunkId: 'chunk-3',
      content: 'third result',
      documentId: 'doc-1',
      filename: null,
    },
  ];

  beforeEach(async () => {
    mockChunkRepository = { keywordSearch: jest.fn() };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LexicalRetrievalService,
        { provide: ChunkRepository, useValue: mockChunkRepository },
        {
          provide: getLoggerToken(LexicalRetrievalService.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<LexicalRetrievalService>(LexicalRetrievalService);
  });

  afterEach(() => jest.clearAllMocks());

  // ----------------------------------------------------------------
  // topK clamping
  // ----------------------------------------------------------------
  describe('topK clamping', () => {
    it('clamps topK to MAX before passing to keywordSearch', async () => {
      mockChunkRepository.keywordSearch.mockResolvedValue([]);

      await service.retrieve({ ...baseQuery, topK: 999 });

      expect(mockChunkRepository.keywordSearch).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 20 }),
      );
    });

    it('clamps topK to MIN when zero is passed', async () => {
      mockChunkRepository.keywordSearch.mockResolvedValue([]);

      await service.retrieve({ ...baseQuery, topK: 0 });

      expect(mockChunkRepository.keywordSearch).toHaveBeenCalledWith(
        expect.objectContaining({ limit: 1 }),
      );
    });
  });

  // ----------------------------------------------------------------
  // Filter passthrough
  // ----------------------------------------------------------------
  describe('filter passthrough', () => {
    it('passes documentIds filter to keywordSearch', async () => {
      mockChunkRepository.keywordSearch.mockResolvedValue([]);

      await service.retrieve({
        ...baseQuery,
        filters: { documentIds: ['doc-1', 'doc-2'] },
      });

      expect(mockChunkRepository.keywordSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: { documentIds: ['doc-1', 'doc-2'], mimeTypes: undefined },
        }),
      );
    });

    it('passes mimeTypes filter to keywordSearch', async () => {
      mockChunkRepository.keywordSearch.mockResolvedValue([]);

      await service.retrieve({
        ...baseQuery,
        filters: { mimeTypes: ['application/pdf'] },
      });

      expect(mockChunkRepository.keywordSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: { documentIds: undefined, mimeTypes: ['application/pdf'] },
        }),
      );
    });

    it('passes undefined filters when no filters provided', async () => {
      mockChunkRepository.keywordSearch.mockResolvedValue([]);

      await service.retrieve(baseQuery);

      expect(mockChunkRepository.keywordSearch).toHaveBeenCalledWith(
        expect.objectContaining({
          filters: { documentIds: undefined, mimeTypes: undefined },
        }),
      );
    });
  });

  // ----------------------------------------------------------------
  // Empty results
  // ----------------------------------------------------------------
  describe('empty results', () => {
    it('returns empty array when keywordSearch returns no results', async () => {
      mockChunkRepository.keywordSearch.mockResolvedValue([]);

      const results = await service.retrieve(baseQuery);

      expect(results).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // Result mapping
  // ----------------------------------------------------------------
  describe('result mapping', () => {
    beforeEach(() => {
      mockChunkRepository.keywordSearch.mockResolvedValue(mockSearchResults);
    });

    it('maps results to RetrievedContext shape', async () => {
      const results = await service.retrieve(baseQuery);

      expect(results[0]).toEqual({
        chunkId: 'chunk-1',
        content: 'first result',
        score: 1,
        source: { documentId: 'doc-1', filename: 'file1.pdf' },
        signals: { lexicalRank: 1 },
      });
    });

    it('assigns 1-based rank as score', async () => {
      const results = await service.retrieve(baseQuery);

      expect(results.map((r) => r.score)).toEqual([1, 2, 3]);
    });

    it('lexicalRank matches score position', async () => {
      const results = await service.retrieve(baseQuery);

      results.forEach((r, index) => {
        expect(r.signals.lexicalRank).toBe(index + 1);
        expect(r.score).toBe(index + 1);
      });
    });

    it('falls back to unknown when filename is null', async () => {
      const results = await service.retrieve(baseQuery);

      expect(results[2].source.filename).toBe('unknown');
    });

    it('does not include vectorRank or vectorSimilarity in signals', async () => {
      const results = await service.retrieve(baseQuery);

      expect(results[0].signals).not.toHaveProperty('vectorRank');
      expect(results[0].signals).not.toHaveProperty('vectorSimilarity');
    });
  });

  // ----------------------------------------------------------------
  // Error propagation
  // ----------------------------------------------------------------
  describe('error propagation', () => {
    it('propagates error when keywordSearch throws', async () => {
      mockChunkRepository.keywordSearch.mockRejectedValue(
        new Error('DB connection lost'),
      );

      await expect(service.retrieve(baseQuery)).rejects.toThrow(
        'DB connection lost',
      );
    });
  });
});
