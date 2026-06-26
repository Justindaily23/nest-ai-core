import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { ParentExpansionService } from './parent-expansion.service';
import { ChunkRepository } from '../../persistence/repositories/chunk.repository';

describe('ParentExpansionService', () => {
  let service: ParentExpansionService;

  let mockChunkRepository: { findByIds: jest.Mock };
  let mockLogger: { warn: jest.Mock; debug: jest.Mock; error: jest.Mock };

  const tenantId = 'tenant-1';

  const mockRetrievedContexts = [
    {
      chunkId: 'chunk-1',
      content: 'child content one',
      score: 0.95,
      source: { documentId: 'doc-1', filename: 'file.pdf' },
      signals: { vectorRank: 1 },
    },
    {
      chunkId: 'chunk-2',
      content: 'child content two',
      score: 0.85,
      source: { documentId: 'doc-1', filename: 'file.pdf' },
      signals: { vectorRank: 2 },
    },
    {
      chunkId: 'chunk-3',
      content: 'child content three',
      score: 0.75,
      source: { documentId: 'doc-2', filename: 'file2.pdf' },
      signals: { vectorRank: 3 },
    },
  ];

  const mockChildChunks = [
    {
      id: 'chunk-1',
      content: 'child content one',
      parentChunkId: 'parent-1',
      documentId: 'doc-1',
      filename: 'file.pdf',
      role: 'CHILD',
    },
    {
      id: 'chunk-2',
      content: 'child content two',
      parentChunkId: 'parent-1',
      documentId: 'doc-1',
      filename: 'file.pdf',
      role: 'CHILD',
    },
    {
      id: 'chunk-3',
      content: 'child content three',
      parentChunkId: 'parent-2',
      documentId: 'doc-2',
      filename: 'file2.pdf',
      role: 'CHILD',
    },
  ];

  const mockParentChunks = [
    {
      id: 'parent-1',
      content: 'parent content one',
      parentChunkId: null,
      documentId: 'doc-1',
      filename: 'file.pdf',
      role: 'PARENT',
    },
    {
      id: 'parent-2',
      content: 'parent content two',
      parentChunkId: null,
      documentId: 'doc-2',
      filename: 'file2.pdf',
      role: 'PARENT',
    },
  ];

  beforeEach(async () => {
    mockChunkRepository = { findByIds: jest.fn() };
    mockLogger = { warn: jest.fn(), debug: jest.fn(), error: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ParentExpansionService,
        { provide: ChunkRepository, useValue: mockChunkRepository },
        {
          provide: getLoggerToken(ParentExpansionService.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<ParentExpansionService>(ParentExpansionService);
  });

  afterEach(() => jest.clearAllMocks());

  // ----------------------------------------------------------------
  // Early exits
  // ----------------------------------------------------------------
  describe('early exits', () => {
    it('returns empty array when results is empty', async () => {
      const output = await service.expand([], tenantId);

      expect(output).toEqual([]);
      expect(mockChunkRepository.findByIds).not.toHaveBeenCalled();
    });

    it('returns empty array when no chunks found for retrieved IDs', async () => {
      mockChunkRepository.findByIds.mockResolvedValue([]);

      const output = await service.expand(mockRetrievedContexts, tenantId);

      expect(output).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // Database calls
  // ----------------------------------------------------------------
  describe('database calls', () => {
    it('fetches child chunks with the correct chunkIds', async () => {
      mockChunkRepository.findByIds
        .mockResolvedValueOnce(mockChildChunks)
        .mockResolvedValueOnce(mockParentChunks);

      await service.expand(mockRetrievedContexts, tenantId);

      expect(mockChunkRepository.findByIds).toHaveBeenNthCalledWith(
        1,
        tenantId,
        ['chunk-1', 'chunk-2', 'chunk-3'],
      );
    });

    it('fetches parent chunks with unique parent IDs only', async () => {
      mockChunkRepository.findByIds
        .mockResolvedValueOnce(mockChildChunks)
        .mockResolvedValueOnce(mockParentChunks);

      await service.expand(mockRetrievedContexts, tenantId);

      expect(mockChunkRepository.findByIds).toHaveBeenNthCalledWith(
        2,
        tenantId,
        expect.arrayContaining(['parent-1', 'parent-2']),
      );
    });

    it('makes exactly two database calls regardless of result count', async () => {
      mockChunkRepository.findByIds
        .mockResolvedValueOnce(mockChildChunks)
        .mockResolvedValueOnce(mockParentChunks);

      await service.expand(mockRetrievedContexts, tenantId);

      expect(mockChunkRepository.findByIds).toHaveBeenCalledTimes(2);
    });
  });

  // ----------------------------------------------------------------
  // Grouping logic
  // ----------------------------------------------------------------
  describe('grouping logic', () => {
    beforeEach(() => {
      mockChunkRepository.findByIds
        .mockResolvedValueOnce(mockChildChunks)
        .mockResolvedValueOnce(mockParentChunks);
    });

    it('groups children under their correct parent', async () => {
      const output = await service.expand(mockRetrievedContexts, tenantId);

      const parent1 = output.find((p) => p.parentChunkId === 'parent-1');
      expect(parent1?.children).toHaveLength(2);
      expect(parent1?.children.map((c) => c.chunkId)).toEqual(
        expect.arrayContaining(['chunk-1', 'chunk-2']),
      );
    });

    it('assigns correct content to each child', async () => {
      const output = await service.expand(mockRetrievedContexts, tenantId);

      const parent1 = output.find((p) => p.parentChunkId === 'parent-1');
      const child1 = parent1?.children.find((c) => c.chunkId === 'chunk-1');
      expect(child1?.content).toBe('child content one');
    });

    it('assigns parent content from parent chunk row', async () => {
      const output = await service.expand(mockRetrievedContexts, tenantId);

      const parent1 = output.find((p) => p.parentChunkId === 'parent-1');
      expect(parent1?.parentContent).toBe('parent content one');
    });

    it('skips children with null parentChunkId', async () => {
      const orphanChunk = {
        id: 'orphan',
        content: 'orphan content',
        parentChunkId: null,
        documentId: 'doc-1',
        filename: 'file.pdf',
        role: 'PARENT',
      };

      mockChunkRepository.findByIds
        .mockReset()
        .mockResolvedValueOnce([...mockChildChunks, orphanChunk])
        .mockResolvedValueOnce(mockParentChunks);

      const output = await service.expand(mockRetrievedContexts, tenantId);

      const orphanParent = output.find((p) => p.parentChunkId === 'orphan');
      expect(orphanParent).toBeUndefined();
    });

    it('skips children whose parent content is not found', async () => {
      mockChunkRepository.findByIds
        .mockReset()
        .mockResolvedValueOnce(mockChildChunks)
        .mockResolvedValueOnce([mockParentChunks[0]]); // only parent-1 returned

      const output = await service.expand(mockRetrievedContexts, tenantId);

      const parent2 = output.find((p) => p.parentChunkId === 'parent-2');
      expect(parent2).toBeUndefined();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // Score inheritance
  // ----------------------------------------------------------------
  describe('score inheritance', () => {
    beforeEach(() => {
      mockChunkRepository.findByIds
        .mockResolvedValueOnce(mockChildChunks)
        .mockResolvedValueOnce(mockParentChunks);
    });

    it('assigns parent score as highest child score', async () => {
      const output = await service.expand(mockRetrievedContexts, tenantId);

      // chunk-1 = 0.95, chunk-2 = 0.85 — parent-1 should take 0.95
      const parent1 = output.find((p) => p.parentChunkId === 'parent-1');
      expect(parent1?.score).toBe(0.95);
    });

    it('assigns child score directly when parent has only one child', async () => {
      const output = await service.expand(mockRetrievedContexts, tenantId);

      const parent2 = output.find((p) => p.parentChunkId === 'parent-2');
      expect(parent2?.score).toBe(0.75);
    });
  });

  // ----------------------------------------------------------------
  // Sorting
  // ----------------------------------------------------------------
  describe('sorting', () => {
    it('sorts parents by score descending', async () => {
      mockChunkRepository.findByIds
        .mockResolvedValueOnce(mockChildChunks)
        .mockResolvedValueOnce(mockParentChunks);

      const output = await service.expand(mockRetrievedContexts, tenantId);

      expect(output[0].score).toBeGreaterThanOrEqual(output[1].score);
      expect(output[0].parentChunkId).toBe('parent-1');
    });
  });
});
