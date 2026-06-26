// query-embedding.service.spec.ts

import { Test, TestingModule } from '@nestjs/testing';
import { QueryEmbeddingService } from './query-embedding.service';
import { EmbeddingProvider } from '../../embeddings/interfaces/embedding-provider.interface';

describe('QueryEmbeddingService', () => {
  let service: QueryEmbeddingService;
  let mockEmbeddingProvider: { embed: jest.Mock };

  beforeEach(async () => {
    mockEmbeddingProvider = { embed: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueryEmbeddingService,
        { provide: EmbeddingProvider, useValue: mockEmbeddingProvider },
      ],
    }).compile();

    service = module.get<QueryEmbeddingService>(QueryEmbeddingService);
  });

  afterEach(() => jest.clearAllMocks());

  it('returns vector when provider returns a valid embedding', async () => {
    const vector = [0.1, 0.2, 0.3];
    mockEmbeddingProvider.embed.mockResolvedValue(vector);

    const result = await service.embed('what is RAG?');

    expect(result).toEqual(vector);
  });

  it('calls provider with the exact query string', async () => {
    mockEmbeddingProvider.embed.mockResolvedValue([0.1, 0.2]);

    await service.embed('what is RAG?');

    expect(mockEmbeddingProvider.embed).toHaveBeenCalledWith('what is RAG?');
  });

  it('throws when provider returns empty array', async () => {
    mockEmbeddingProvider.embed.mockResolvedValue([]);

    await expect(service.embed('what is RAG?')).rejects.toThrow(
      'Query embedding returned empty vector',
    );
  });

  it('throws when provider returns null', async () => {
    mockEmbeddingProvider.embed.mockResolvedValue(null);

    await expect(service.embed('what is RAG?')).rejects.toThrow(
      'Query embedding returned empty vector',
    );
  });

  it('propagates error when provider throws', async () => {
    mockEmbeddingProvider.embed.mockRejectedValue(new Error('OpenAI timeout'));

    await expect(service.embed('what is RAG?')).rejects.toThrow(
      'OpenAI timeout',
    );
  });
});
