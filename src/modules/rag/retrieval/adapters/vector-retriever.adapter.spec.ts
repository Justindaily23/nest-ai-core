import { Test, TestingModule } from '@nestjs/testing';
import { VectorRetrieverAdapter } from './vector-retriever.adapter';
import { VectorRetrievalService } from '../services/vector-retrieval.service';
import { QueryEmbeddingService } from '../services/query-embedding.service';

describe('VectorRetrieverAdapter', () => {
  let adapter: VectorRetrieverAdapter;

  let mockVectorService: { retrieveFlat: jest.Mock };
  let mockEmbeddingService: { embed: jest.Mock };

  const mockEmbedding = [0.1, 0.2, 0.3];

  const mockFlatResults = [
    {
      chunkId: 'chunk-1',
      content: 'first result',
      score: 0.95,
      documentId: 'doc-1',
      filename: 'file1.pdf',
    },
    {
      chunkId: 'chunk-2',
      content: 'second result',
      score: 0.82,
      documentId: 'doc-2',
      filename: 'file2.pdf',
    },
    {
      chunkId: 'chunk-3',
      content: 'third result',
      score: 0.71,
      documentId: 'doc-1',
      filename: 'file1.pdf',
    },
  ];

  const baseQuery = {
    tenantId: 'tenant-1',
    query: 'what is RAG?',
    topK: 10,
  };

  beforeEach(async () => {
    mockVectorService = {
      retrieveFlat: jest.fn().mockResolvedValue(mockFlatResults),
    };
    mockEmbeddingService = {
      embed: jest.fn().mockResolvedValue(mockEmbedding),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        VectorRetrieverAdapter,
        { provide: VectorRetrievalService, useValue: mockVectorService },
        { provide: QueryEmbeddingService, useValue: mockEmbeddingService },
      ],
    }).compile();

    adapter = module.get<VectorRetrieverAdapter>(VectorRetrieverAdapter);
  });

  afterEach(() => jest.clearAllMocks());

  // ----------------------------------------------------------------
  // Embedding call
  // ----------------------------------------------------------------
  describe('embedding', () => {
    it('embeds the query text before retrieval', async () => {
      await adapter.retrieve(baseQuery);

      expect(mockEmbeddingService.embed).toHaveBeenCalledWith('what is RAG?');
    });

    it('passes the embedding to retrieveFlat', async () => {
      await adapter.retrieve(baseQuery);

      expect(mockVectorService.retrieveFlat).toHaveBeenCalledWith(
        expect.objectContaining({ queryEmbedding: mockEmbedding }),
      );
    });
  });

  // ----------------------------------------------------------------
  // topK clamping
  // ----------------------------------------------------------------
  describe('topK clamping', () => {
    it('clamps topK to MAX before passing to retrieveFlat', async () => {
      await adapter.retrieve({ ...baseQuery, topK: 999 });

      expect(mockVectorService.retrieveFlat).toHaveBeenCalledWith(
        expect.objectContaining({ topK: 20 }),
      );
    });

    it('clamps topK to MIN when zero is passed', async () => {
      await adapter.retrieve({ ...baseQuery, topK: 0 });

      expect(mockVectorService.retrieveFlat).toHaveBeenCalledWith(
        expect.objectContaining({ topK: 1 }),
      );
    });
  });

  // ----------------------------------------------------------------
  // Result mapping
  // ----------------------------------------------------------------
  describe('result mapping', () => {
    it('maps results to RetrievedContext shape', async () => {
      const results = await adapter.retrieve(baseQuery);

      expect(results[0]).toEqual({
        chunkId: 'chunk-1',
        content: 'first result',
        score: 1,
        source: { documentId: 'doc-1', filename: 'file1.pdf' },
        signals: { vectorRank: 1, vectorSimilarity: 0.95 },
      });
    });

    it('assigns rank as 1-based index position', async () => {
      const results = await adapter.retrieve(baseQuery);

      expect(results.map((r) => r.score)).toEqual([1, 2, 3]);
    });

    it('preserves real cosine similarity in signals.vectorSimilarity', async () => {
      const results = await adapter.retrieve(baseQuery);

      expect(results[0].signals.vectorSimilarity).toBe(0.95);
      expect(results[1].signals.vectorSimilarity).toBe(0.82);
      expect(results[2].signals.vectorSimilarity).toBe(0.71);
    });

    it('vectorRank matches score — both are 1-based position', async () => {
      const results = await adapter.retrieve(baseQuery);

      results.forEach((r, index) => {
        expect(r.signals.vectorRank).toBe(index + 1);
        expect(r.score).toBe(index + 1);
      });
    });

    it('returns empty array when retrieveFlat returns no results', async () => {
      mockVectorService.retrieveFlat.mockResolvedValue([]);

      const results = await adapter.retrieve(baseQuery);

      expect(results).toEqual([]);
    });
  });

  // ----------------------------------------------------------------
  // Model and tenant passthrough
  // ----------------------------------------------------------------
  describe('passthrough', () => {
    it('passes tenantId to retrieveFlat', async () => {
      await adapter.retrieve(baseQuery);

      expect(mockVectorService.retrieveFlat).toHaveBeenCalledWith(
        expect.objectContaining({ tenantId: 'tenant-1' }),
      );
    });

    it('always uses the hardcoded model identifier', async () => {
      await adapter.retrieve(baseQuery);

      expect(mockVectorService.retrieveFlat).toHaveBeenCalledWith(
        expect.objectContaining({ model: 'text-embedding-3-small' }),
      );
    });
  });

  // ----------------------------------------------------------------
  // Error propagation
  // ----------------------------------------------------------------
  describe('error propagation', () => {
    it('propagates error when embedding fails', async () => {
      mockEmbeddingService.embed.mockRejectedValue(new Error('OpenAI timeout'));

      await expect(adapter.retrieve(baseQuery)).rejects.toThrow(
        'OpenAI timeout',
      );
    });

    it('propagates error when retrieveFlat fails', async () => {
      mockVectorService.retrieveFlat.mockRejectedValue(new Error('DB error'));

      await expect(adapter.retrieve(baseQuery)).rejects.toThrow('DB error');
    });
  });
});
