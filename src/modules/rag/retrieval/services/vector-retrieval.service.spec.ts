import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { VectorRetrievalService } from './vector-retrieval.service';
import { RetrievalRepository } from '../repositories/retrieval.repository';
import { ChunkRepository } from '@/modules/rag/persistence/repositories/chunk.repository';
import { OperationalException } from '@/common/exceptions/operational.exception';

describe('VectorRetrievalService', () => {
  let service: VectorRetrievalService;

  let mockRetrievalRepository: { search: jest.Mock };
  let mockChunkRepository: {
    findByIds: jest.Mock;
    findParentsWithChildren: jest.Mock;
  };
  let mockLogger: {
    debug: jest.Mock;
    info: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
  };

  const baseParams = {
    tenantId: 'tenant-1',
    model: 'text-embedding-3-small',
    queryEmbedding: [0.1, 0.2, 0.3],
    topK: 10,
  };

  const mockSearchResults = [
    { chunkId: 'chunk-1', score: 0.95 },
    { chunkId: 'chunk-2', score: 0.85 },
    { chunkId: 'chunk-3', score: 0.75 },
  ];

  const mockChunks = [
    {
      id: 'chunk-1',
      content: 'content one',
      documentId: 'doc-1',
      filename: 'file1.pdf',
      parentChunkId: 'parent-1',
      role: 'CHILD',
    },
    {
      id: 'chunk-2',
      content: 'content two',
      documentId: 'doc-1',
      filename: 'file1.pdf',
      parentChunkId: 'parent-1',
      role: 'CHILD',
    },
    {
      id: 'chunk-3',
      content: 'content three',
      documentId: 'doc-2',
      filename: 'file2.pdf',
      parentChunkId: 'parent-2',
      role: 'CHILD',
    },
  ];

  beforeEach(async () => {
    mockRetrievalRepository = { search: jest.fn() };
    mockChunkRepository = {
      findByIds: jest.fn(),
      findParentsWithChildren: jest.fn(),
    };
    mockLogger = {
      debug: jest.fn(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorRetrievalService,
        { provide: RetrievalRepository, useValue: mockRetrievalRepository },
        { provide: ChunkRepository, useValue: mockChunkRepository },
        {
          provide: getLoggerToken(VectorRetrievalService.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<VectorRetrievalService>(VectorRetrievalService);
  });

  afterEach(() => jest.clearAllMocks());

  // ----------------------------------------------------------------
  // retrieveFlat
  // ----------------------------------------------------------------
  describe('retrieveFlat', () => {
    describe('empty results', () => {
      it('returns empty array when search returns no results', async () => {
        mockRetrievalRepository.search.mockResolvedValue([]);

        const results = await service.retrieveFlat(baseParams);

        expect(results).toEqual([]);
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('returns empty array when all results fail score threshold', async () => {
        mockRetrievalRepository.search.mockResolvedValue([
          { chunkId: 'chunk-1', score: 0.3 },
          { chunkId: 'chunk-2', score: 0.5 },
        ]);

        const results = await service.retrieveFlat({
          ...baseParams,
          minScore: 0.7,
        });

        expect(results).toEqual([]);
        expect(mockLogger.warn).toHaveBeenCalled();
      });

      it('returns empty array when chunk hydration finds no matching rows', async () => {
        mockRetrievalRepository.search.mockResolvedValue(mockSearchResults);
        mockChunkRepository.findByIds.mockResolvedValue([]);

        const results = await service.retrieveFlat(baseParams);

        expect(results).toEqual([]);
        expect(mockLogger.warn).toHaveBeenCalled();
      });
    });

    describe('score filtering', () => {
      it('filters out results below minScore', async () => {
        mockRetrievalRepository.search.mockResolvedValue([
          { chunkId: 'chunk-1', score: 0.95 },
          { chunkId: 'chunk-2', score: 0.65 }, // below default 0.7
        ]);
        mockChunkRepository.findByIds.mockResolvedValue([mockChunks[0]]);

        const results = await service.retrieveFlat(baseParams);

        expect(results).toHaveLength(1);
        expect(results[0].chunkId).toBe('chunk-1');
      });

      it('uses custom minScore when provided', async () => {
        mockRetrievalRepository.search.mockResolvedValue([
          { chunkId: 'chunk-1', score: 0.55 },
          { chunkId: 'chunk-2', score: 0.45 }, // below custom 0.5
        ]);
        mockChunkRepository.findByIds.mockResolvedValue([mockChunks[0]]);

        const results = await service.retrieveFlat({
          ...baseParams,
          minScore: 0.5,
        });

        expect(results).toHaveLength(1);
        expect(results[0].chunkId).toBe('chunk-1');
      });

      it('uses default minScore of 0.7 when not provided', async () => {
        mockRetrievalRepository.search.mockResolvedValue([
          { chunkId: 'chunk-1', score: 0.69 }, // just below default
        ]);

        const results = await service.retrieveFlat(baseParams);

        expect(results).toEqual([]);
      });
    });

    describe('integrity check', () => {
      it('throws OperationalException when vector result has no matching chunk row', async () => {
        mockRetrievalRepository.search.mockResolvedValue([
          { chunkId: 'chunk-1', score: 0.95 },
          { chunkId: 'orphan-chunk', score: 0.85 }, // not in DB
        ]);
        mockChunkRepository.findByIds.mockResolvedValue([mockChunks[0]]); // only chunk-1 found

        await expect(service.retrieveFlat(baseParams)).rejects.toThrow(
          OperationalException,
        );
        expect(mockLogger.error).toHaveBeenCalled();
      });

      it('does not throw when all vector results have matching chunk rows', async () => {
        mockRetrievalRepository.search.mockResolvedValue(mockSearchResults);
        mockChunkRepository.findByIds.mockResolvedValue(mockChunks);

        await expect(service.retrieveFlat(baseParams)).resolves.not.toThrow();
      });
    });

    describe('result shape', () => {
      it('returns correct RetrievedChunk shape', async () => {
        mockRetrievalRepository.search.mockResolvedValue([
          { chunkId: 'chunk-1', score: 0.95 },
        ]);
        mockChunkRepository.findByIds.mockResolvedValue([mockChunks[0]]);

        const results = await service.retrieveFlat(baseParams);

        expect(results[0]).toEqual({
          chunkId: 'chunk-1',
          score: 0.95,
          content: 'content one',
          documentId: 'doc-1',
          filename: 'file1.pdf',
        });
      });

      it('uses Unknown Document as filename fallback when filename is null', async () => {
        mockRetrievalRepository.search.mockResolvedValue([
          { chunkId: 'chunk-1', score: 0.95 },
        ]);
        mockChunkRepository.findByIds.mockResolvedValue([
          { ...mockChunks[0], filename: null },
        ]);

        const results = await service.retrieveFlat(baseParams);

        expect(results[0].filename).toBe('Unknown Document');
      });

      it('preserves original similarity score, not rank position', async () => {
        mockRetrievalRepository.search.mockResolvedValue(mockSearchResults);
        mockChunkRepository.findByIds.mockResolvedValue(mockChunks);

        const results = await service.retrieveFlat(baseParams);

        expect(results.map((r) => r.score)).toEqual([0.95, 0.85, 0.75]);
      });
    });
  });

  // ----------------------------------------------------------------
  // retrieveWithParentExpansion
  // ----------------------------------------------------------------
  describe('retrieveWithParentExpansion', () => {
    const mockParentRows = [
      {
        parentId: 'parent-1',
        parentContent: 'parent content one',
        childId: 'chunk-1',
        childContent: 'content one',
      },
      {
        parentId: 'parent-1',
        parentContent: 'parent content one',
        childId: 'chunk-2',
        childContent: 'content two',
      },
      {
        parentId: 'parent-2',
        parentContent: 'parent content two',
        childId: 'chunk-3',
        childContent: 'content three',
      },
    ];

    beforeEach(() => {
      mockRetrievalRepository.search.mockResolvedValue(mockSearchResults);
      mockChunkRepository.findByIds.mockResolvedValue(mockChunks);
    });

    it('returns empty array when retrieveFlat returns no results', async () => {
      mockRetrievalRepository.search.mockResolvedValue([]);

      const results = await service.retrieveWithParentExpansion(baseParams);

      expect(results).toEqual([]);
    });

    it('groups children under their parent correctly', async () => {
      mockChunkRepository.findParentsWithChildren.mockResolvedValue(
        mockParentRows,
      );

      const results = await service.retrieveWithParentExpansion(baseParams);

      const parent1 = results.find((r) => r.parentChunkId === 'parent-1');
      expect(parent1?.children).toHaveLength(2);
      expect(parent1?.children.map((c) => c.chunkId)).toEqual(
        expect.arrayContaining(['chunk-1', 'chunk-2']),
      );
    });

    it('assigns parent score as highest child score', async () => {
      mockChunkRepository.findParentsWithChildren.mockResolvedValue(
        mockParentRows,
      );

      const results = await service.retrieveWithParentExpansion(baseParams);

      const parent1 = results.find((r) => r.parentChunkId === 'parent-1');
      // chunk-1 has 0.95, chunk-2 has 0.85 — parent should take 0.95
      expect(parent1?.score).toBe(0.95);
    });

    it('sorts parents by score descending', async () => {
      mockChunkRepository.findParentsWithChildren.mockResolvedValue(
        mockParentRows,
      );

      const results = await service.retrieveWithParentExpansion(baseParams);

      expect(results[0].score).toBeGreaterThanOrEqual(results[1].score);
    });

    it('falls back to flat results when parent expansion returns no rows', async () => {
      mockChunkRepository.findParentsWithChildren.mockResolvedValue([]);

      const results = await service.retrieveWithParentExpansion(baseParams);

      expect(results).toHaveLength(3);
      expect(mockLogger.warn).toHaveBeenCalled();
      // Each child wrapped as its own parent
      results.forEach((r) => {
        expect(r.children).toHaveLength(1);
        expect(r.children[0].chunkId).toBe(r.parentChunkId);
      });
    });

    it('skips rows whose childId is not in the score map (concurrent deletion guard)', async () => {
      mockChunkRepository.findParentsWithChildren.mockResolvedValue([
        ...mockParentRows,
        {
          parentId: 'parent-3',
          parentContent: 'stale parent',
          childId: 'deleted-chunk', // not in flatResults
          childContent: 'stale content',
        },
      ]);

      const results = await service.retrieveWithParentExpansion(baseParams);

      const staleParent = results.find((r) => r.parentChunkId === 'parent-3');
      expect(staleParent).toBeUndefined();
    });
  });
});
