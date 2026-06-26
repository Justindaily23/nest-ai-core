import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { RetrievalExecutionService } from './retrieval-execution.service';
import { HybridRetrievalService } from './hybrid-retrieval.service';
import { VectorRetrieverAdapter } from '../adapters/vector-retriever.adapter';
import { LexicalRetrievalService } from './lexical-retrieval.service';

describe('RetrievalExecutionService', () => {
  let service: RetrievalExecutionService;

  let mockHybridService: { retrieve: jest.Mock };
  let mockVectorAdapter: { retrieve: jest.Mock };
  let mockLexicalService: { retrieve: jest.Mock };
  let mockLogger: { debug: jest.Mock; info: jest.Mock; error: jest.Mock };

  const mockResults = [
    {
      chunkId: 'chunk-1',
      content: 'content',
      score: 0.9,
      source: { documentId: 'doc-1', filename: 'file.pdf' },
      signals: {},
    },
  ];

  const basePlan = {
    tenantId: 'tenant-1',
    query: 'what is RAG?',
    topK: 10,
    filters: undefined,
    options: {
      enableParentExpansion: true,
      enableRank: false,
      minimumVectorScore: 0.7,
    },
  };

  beforeEach(async () => {
    mockHybridService = { retrieve: jest.fn().mockResolvedValue(mockResults) };
    mockVectorAdapter = { retrieve: jest.fn().mockResolvedValue(mockResults) };
    mockLexicalService = { retrieve: jest.fn().mockResolvedValue(mockResults) };
    mockLogger = { debug: jest.fn(), info: jest.fn(), error: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RetrievalExecutionService,
        { provide: HybridRetrievalService, useValue: mockHybridService },
        { provide: VectorRetrieverAdapter, useValue: mockVectorAdapter },
        { provide: LexicalRetrievalService, useValue: mockLexicalService },
        {
          provide: getLoggerToken(RetrievalExecutionService.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<RetrievalExecutionService>(RetrievalExecutionService);
  });

  afterEach(() => jest.clearAllMocks());

  // ----------------------------------------------------------------
  // Strategy routing
  // ----------------------------------------------------------------
  describe('strategy routing', () => {
    it('dispatches to hybrid service for hybrid strategy', async () => {
      await service.execute({ ...basePlan, strategy: 'hybrid' });

      expect(mockHybridService.retrieve).toHaveBeenCalledWith(
        expect.objectContaining({ strategy: 'hybrid' }),
      );
      expect(mockVectorAdapter.retrieve).not.toHaveBeenCalled();
      expect(mockLexicalService.retrieve).not.toHaveBeenCalled();
    });

    it('dispatches to vector adapter for vector-only strategy', async () => {
      await service.execute({ ...basePlan, strategy: 'vector-only' });

      expect(mockVectorAdapter.retrieve).toHaveBeenCalledWith(
        expect.objectContaining({ strategy: 'vector-only' }),
      );
      expect(mockHybridService.retrieve).not.toHaveBeenCalled();
      expect(mockLexicalService.retrieve).not.toHaveBeenCalled();
    });

    it('dispatches to lexical service for lexical-only strategy', async () => {
      await service.execute({ ...basePlan, strategy: 'lexical-only' });

      expect(mockLexicalService.retrieve).toHaveBeenCalledWith(
        expect.objectContaining({ strategy: 'lexical-only' }),
      );
      expect(mockHybridService.retrieve).not.toHaveBeenCalled();
      expect(mockVectorAdapter.retrieve).not.toHaveBeenCalled();
    });

    it('falls back to hybrid for unknown strategy', async () => {
      await service.execute({ ...basePlan, strategy: 'unknown' as any });

      expect(mockHybridService.retrieve).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // Return value
  // ----------------------------------------------------------------
  describe('return value', () => {
    it('returns results from the dispatched retriever', async () => {
      const results = await service.execute({
        ...basePlan,
        strategy: 'hybrid',
      });

      expect(results).toEqual(mockResults);
    });

    it('returns empty array when retriever returns nothing', async () => {
      mockHybridService.retrieve.mockResolvedValue([]);

      const results = await service.execute({
        ...basePlan,
        strategy: 'hybrid',
      });

      expect(results).toEqual([]);
    });
  });

  // ----------------------------------------------------------------
  // Observability
  // ----------------------------------------------------------------
  describe('observability', () => {
    it('logs debug before execution with tenantId, strategy, and topK', async () => {
      await service.execute({ ...basePlan, strategy: 'hybrid' });

      expect(mockLogger.debug).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          strategy: 'hybrid',
          topK: 10,
        }),
        expect.any(String),
      );
    });

    it('logs info after execution with count and durationMs', async () => {
      await service.execute({ ...basePlan, strategy: 'hybrid' });

      expect(mockLogger.info).toHaveBeenCalledWith(
        expect.objectContaining({
          tenantId: 'tenant-1',
          strategy: 'hybrid',
          count: mockResults.length,
          durationMs: expect.any(Number),
        }),
        expect.any(String),
      );
    });
  });

  // ----------------------------------------------------------------
  // Error propagation
  // ----------------------------------------------------------------
  describe('error propagation', () => {
    it('propagates error when dispatched retriever throws', async () => {
      mockHybridService.retrieve.mockRejectedValue(
        new Error('retrieval failed'),
      );

      await expect(
        service.execute({ ...basePlan, strategy: 'hybrid' }),
      ).rejects.toThrow('retrieval failed');
    });
  });
});
