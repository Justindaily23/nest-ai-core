import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { EmbeddingService } from './embedding.service';
import { EmbeddingRepository } from '../../persistence/repositories/embedding.repository';
import { EmbeddingProvider } from '../interfaces/embedding-provider.interface';
import { EmbeddingGenerationException } from '../exceptions/embedding.exception';

describe('EmbeddingService', () => {
  let service: EmbeddingService;
  let mockRepository: {
    existsByChunkAndModel: jest.Mock;
    upsert: jest.Mock;
  };

  let mockProvider: {
    embed: jest.Mock;
  };
  let mockLogger: { warn: jest.Mock; debug: jest.Mock; error: jest.Mock };

  const baseParams = {
    tenantId: 'tenant-1',
    chunkId: 'chunk-1',
    content: 'Some valid content to embed',
    model: 'text-embedding-3-small',
  };

  const validVector = [0.1, 0.2, 0.3];

  beforeEach(async () => {
    mockRepository = {
      existsByChunkAndModel: jest.fn(),
      upsert: jest.fn(),
    };

    mockProvider = {
      embed: jest.fn(),
    };

    mockLogger = {
      warn: jest.fn(),
      debug: jest.fn(),
      error: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EmbeddingService,
        { provide: EmbeddingRepository, useValue: mockRepository },
        { provide: EmbeddingProvider, useValue: mockProvider },
        {
          provide: getLoggerToken(EmbeddingService.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<EmbeddingService>(EmbeddingService);
  });

  afterEach(() => jest.clearAllMocks());

  // ----------------------------------------------------------------
  // Empty content guard
  // ----------------------------------------------------------------
  describe('empty content guard', () => {
    it('skips embedding when content is empty string', async () => {
      await service.embedChunk({ ...baseParams, content: '' });

      expect(mockProvider.embed).not.toHaveBeenCalled();
      expect(mockRepository.upsert).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('skips embedding when content is only whitespace', async () => {
      await service.embedChunk({ ...baseParams, content: '   ' });

      expect(mockProvider.embed).not.toHaveBeenCalled();
      expect(mockLogger.warn).toHaveBeenCalled();
    });
  });

  // ----------------------------------------------------------------
  // Idempotency guard
  // ----------------------------------------------------------------
  describe('idempotency guard', () => {
    it('skips provider call when embedding already exists', async () => {
      mockRepository.existsByChunkAndModel.mockResolvedValue(true);

      await service.embedChunk(baseParams);

      expect(mockProvider.embed).not.toHaveBeenCalled();
      expect(mockRepository.upsert).not.toHaveBeenCalled();
      expect(mockLogger.debug).toHaveBeenCalled();
    });

    it('proceeds with embedding when no existing record found', async () => {
      mockRepository.existsByChunkAndModel.mockResolvedValue(false);
      mockProvider.embed.mockResolvedValue(validVector);
      mockRepository.upsert.mockResolvedValue(null as any);
      await service.embedChunk(baseParams);

      expect(mockProvider.embed).toHaveBeenCalledWith(baseParams.content);
      expect(mockRepository.upsert).toHaveBeenCalledWith({
        tenantId: baseParams.tenantId,
        chunkId: baseParams.chunkId,
        model: baseParams.model,
        embedding: validVector,
      });
    });
  });

  // ----------------------------------------------------------------
  // Vector validation
  // ----------------------------------------------------------------
  describe('vector validation', () => {
    beforeEach(() => {
      mockRepository.existsByChunkAndModel.mockResolvedValue(false);
    });

    it('throws EmbeddingGenerationException when provider returns empty vector', async () => {
      mockProvider.embed.mockResolvedValue([]);

      await expect(service.embedChunk(baseParams)).rejects.toThrow(
        EmbeddingGenerationException,
      );
      expect(mockRepository.upsert).not.toHaveBeenCalled();
    });

    it('throws EmbeddingGenerationException when vector contains NaN', async () => {
      mockProvider.embed.mockResolvedValue([0.1, NaN, 0.3]);

      await expect(service.embedChunk(baseParams)).rejects.toThrow(
        EmbeddingGenerationException,
      );
      expect(mockRepository.upsert).not.toHaveBeenCalled();
    });

    it('throws EmbeddingGenerationException when vector contains Infinity', async () => {
      mockProvider.embed.mockResolvedValue([0.1, Infinity, 0.3]);

      await expect(service.embedChunk(baseParams)).rejects.toThrow(
        EmbeddingGenerationException,
      );
      expect(mockRepository.upsert).not.toHaveBeenCalled();
    });

    it('throws EmbeddingGenerationException when vector is all zeros', async () => {
      mockProvider.embed.mockResolvedValue([0, 0, 0]);

      await expect(service.embedChunk(baseParams)).rejects.toThrow(
        EmbeddingGenerationException,
      );
      expect(mockRepository.upsert).not.toHaveBeenCalled();
    });

    it('accepts a valid vector and persists it', async () => {
      mockProvider.embed.mockResolvedValue(validVector);
      mockRepository.upsert.mockResolvedValue(null as any);
      await expect(service.embedChunk(baseParams)).resolves.not.toThrow();
      expect(mockRepository.upsert).toHaveBeenCalledTimes(1);
    });
  });

  // ----------------------------------------------------------------
  // Error handling
  // ----------------------------------------------------------------
  describe('error handling', () => {
    beforeEach(() => {
      mockRepository.existsByChunkAndModel.mockResolvedValue(false);
    });

    it('logs error and rethrows as EmbeddingGenerationException when provider throws', async () => {
      mockProvider.embed.mockRejectedValue(new Error('Provider timeout'));

      await expect(service.embedChunk(baseParams)).rejects.toThrow(
        EmbeddingGenerationException,
      );
      expect(mockLogger.error).toHaveBeenCalled();
      expect(mockRepository.upsert).not.toHaveBeenCalled();
    });

    it('logs error and rethrows when upsert fails', async () => {
      mockProvider.embed.mockResolvedValue(validVector);
      mockRepository.upsert.mockRejectedValue(new Error('DB write failed'));

      await expect(service.embedChunk(baseParams)).rejects.toThrow(
        EmbeddingGenerationException,
      );
      expect(mockLogger.error).toHaveBeenCalled();
    });
  });
});
