import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken, PinoLogger } from 'nestjs-pino';
import { VectorRetrievalService } from '../services/vector-retrieval.service';
import { RetrievalRepository } from '../repositories/retrieval.repository';
import { ChunkRepository } from '@/modules/rag/persistence/repositories/chunk.repository';
import { RetrievedChunk } from '../interfaces/retrieval-repository.interface';

function buildMockLogger(): PinoLogger {
  return {
    debug: jest.fn(),
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    fatal: jest.fn(),
    trace: jest.fn(),
  } as unknown as PinoLogger;
}

describe('retrieveWithParentExpansion - Parent expansion semantics', () => {
  let service: VectorRetrievalService;
  let mockChunkRepo: jest.Mocked<
    Pick<ChunkRepository, 'findParentsWithChildren'>
  >;
  let logger: PinoLogger;

  //Flat results that retrievalFlat will produce -mocked at the service level
  const mockFlatResults: RetrievedChunk[] = [
    {
      chunkId: 'child-1',
      content: 'child 1 content',
      score: 0.91,
      documentId: 'documentId-1',
      filename: 'filename-A.pdf',
    },
    {
      chunkId: 'child-2',
      content: 'child 2 content',
      score: 0.87,
      documentId: 'documentId-2',
      filename: 'filename-B.pdf',
    },
    {
      chunkId: 'child-3',
      content: 'child 3 content',
      score: 0.94,
      documentId: 'documentId-3',
      filename: 'filename-B.pdf',
    },
  ];

  beforeEach(async () => {
    mockChunkRepo = { findParentsWithChildren: jest.fn() };
    logger = buildMockLogger();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorRetrievalService,
        { provide: RetrievalRepository, useValue: { search: jest.fn() } },
        { provide: ChunkRepository, useValue: mockChunkRepo },
        {
          provide: getLoggerToken(VectorRetrievalService.name),
          useValue: logger,
        },
      ],
    }).compile();

    service = module.get(VectorRetrievalService);

    //Mock retrieveFlat at the service level -we are testing expansion logic
    // not the vector search. This isolates the unit under test precisely
    jest.spyOn(service, 'retrieveFlat').mockResolvedValue(mockFlatResults);
  });

  afterEach(() => jest.clearAllMocks());

  it('groups children under correct parents, applies MAX score, sorts by decending order', async () => {
    mockChunkRepo.findParentsWithChildren.mockResolvedValue([
      {
        parentId: 'parent-A',
        parentContent: 'Parent A content',
        childId: 'child-1',
        childContent: 'child 1 content',
      },
      {
        parentId: 'parent-A',
        parentContent: 'Parent A content',
        childId: 'child-2',
        childContent: 'child 2 content',
      },
      {
        parentId: 'parent-B',
        parentContent: 'Parent B content',
        childId: 'child-3',
        childContent: 'child 3 content',
      },
    ]);

    const result = await service.retrieveWithParentExpansion({
      tenantId: 'tenant-1',
      model: 'text-embedding-3-small',
      queryEmbedding: [0.1, 0.2, 0.3],
      topK: 10,
    });

    // Verify repository was called with correct tenantId and childIds from flat results
    expect(mockChunkRepo.findParentsWithChildren).toHaveBeenCalledWith(
      'tenant-1',
      ['child-1', 'child-2', 'child-3'],
    );

    // parent-B ranks first — highest single child score (0.94) beats parent-A's max (0.91)
    expect(result[0].parentChunkId).toBe('parent-B');
    expect(result[0].score).toBe(0.94);
    expect(result[0].children).toHaveLength(1);

    // parent-A ranks second — MAX score is 0.91, not sum (1.78) or avg (0.89)
    expect(result[1].parentChunkId).toBe('parent-A');
    expect(result[1].score).toBe(0.91);
    expect(result[1].children).toHaveLength(2);
  });

  it('falls back gracefully to flat results when repository returns no rows', async () => {
    mockChunkRepo.findParentsWithChildren.mockResolvedValue([]);

    const result = await service.retrieveWithParentExpansion({
      tenantId: 'tenant-1',
      model: 'text-embedding-3-small',
      queryEmbedding: [0.1, 0.2, 0.3],
      topK: 10,
    });

    // Fallback produces one entry per flat result
    expect(result).toHaveLength(mockFlatResults.length);

    // Each entry wraps the child as its own parent
    // parentChunkId = chunkId because no real parent was found
    expect(result[0].parentChunkId).toBe('child-1');
    expect(result[0].score).toBe(0.91);
    expect(result[0].children[0].chunkId).toBe('child-1');

    // Warn was emitted — not an error, not silent
    expect(logger.warn).toHaveBeenCalledTimes(1); // Fallback produces one entry per flat result
    expect(result).toHaveLength(mockFlatResults.length);

    // Each entry wraps the child as its own parent
    // parentChunkId = chunkId because no real parent was found
    expect(result[0].parentChunkId).toBe('child-1');
    expect(result[0].score).toBe(0.91);
    expect(result[0].children[0].chunkId).toBe('child-1');

    // Warn was emitted — not an error, not silent
    expect(logger.warn).toHaveBeenCalledTimes(1);
  });

  it('skips rows where childId is not in the score map (concurrent deletion guard)', async () => {
    // Simulate a row returned by the DB that was not in the original flat results
    // — models a concurrent deletion between the vector search and the DB fetch
    mockChunkRepo.findParentsWithChildren.mockResolvedValue([
      {
        parentId: 'parent-A',
        parentContent: 'Parent A content',
        childId: 'child-1',
        childContent: 'child 1 content',
      },
      {
        parentId: 'parent-A',
        parentContent: 'Parent A content',
        childId: 'ghost-child',
        childContent: 'ghost content',
      },
    ]);

    const result = await service.retrieveWithParentExpansion({
      tenantId: 'tenant-1',
      model: 'text-embedding-3-small',
      queryEmbedding: [0.1, 0.2, 0.3],
      topK: 10,
    });

    const parentA = result.find((r) => r.parentChunkId === 'parent-A');
    expect(parentA).toBeDefined();

    // ghost-child must be silently skipped — it was not in the score map
    const ghostChild = parentA!.children.find(
      (c) => c.chunkId === 'ghost-child',
    );
    expect(ghostChild).toBeUndefined();
  });
});
