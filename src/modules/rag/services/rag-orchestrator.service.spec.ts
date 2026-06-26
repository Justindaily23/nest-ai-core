import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { RagOrchestratorService } from './rag-orchestrator.service';
import { QueryService } from '../query/query.service';
import { RetrievalExecutionService } from '../retrieval/services/retrieval-execution.service';
import { ParentExpansionService } from '../retrieval/services/parent-expansion.service';
import { ContextAssemblyService } from '../context-assembly/service/context-assembly.service';
import { CitationBoundaryService } from '../citation-boundaries/services/citation-boundary.service';
import { PromptFormattingService } from '../prompt-formatting/services/prompt-formatting.service';
import { CitationValidationService } from '../citation/services/citation-validation.service';
import { AIService } from '@/modules/ai/ai.service';
import { AppConfigService } from '@/config/config.service';

describe('RagOrchestratorService', () => {
  let service: RagOrchestratorService;

  let mockQueryService: { buildPlan: jest.Mock };
  let mockExecutionService: { execute: jest.Mock };
  let mockParentExpansionService: { expand: jest.Mock };
  let mockContextAssemblyService: { assemble: jest.Mock };
  let mockCitationBoundaryService: { build: jest.Mock };
  let mockPromptFormattingService: { format: jest.Mock };
  let mockCitationValidationService: { validate: jest.Mock };
  let mockLlm: { generate: jest.Mock };
  let mockAppConfig: {
    llmProvider: string;
    llmModel: string;
    ragTokenBudget: number;
  };
  let mockLogger: { info: jest.Mock; error: jest.Mock; warn: jest.Mock };

  const mockPlan = {
    tenantId: 'tenant-1',
    query: 'what is RAG?',
    topK: 10,
    strategy: 'hybrid',
    options: {
      enableParentExpansion: true,
      enableRank: false,
      minimumVectorScore: 0.7,
    },
  };

  const mockContexts = [
    {
      chunkId: 'chunk-1',
      content: 'content',
      score: 0.9,
      source: { documentId: 'doc-1', filename: 'file.pdf' },
      signals: {},
    },
  ];
  const mockParents = [
    {
      parentChunkId: 'parent-1',
      parentContent: 'parent',
      children: [],
      score: 0.9,
    },
  ];
  const mockAssembled = { totalTokens: 100, budgetTokens: 6000, blocks: [] };
  const mockUnits = [{ citationId: '1', content: 'content', tokens: 10 }];
  const mockCitationMap = {
    '1': { chunkId: 'chunk-1', parentChunkId: 'parent-1' },
  };
  const mockPrompt = {
    messages: [
      { role: 'system', content: 'sys' },
      { role: 'user', content: 'usr' },
    ],
  };
  const mockLlmResponse = {
    content: 'Answer referencing [1].',
    metadata: {
      provider: 'openai',
      model: 'gpt-4o-mini',
      latencyMs: 200,
      usage: { inputTokens: 100, outputTokens: 50, costUsd: 0.001 },
    },
  };
  const mockValidationResult = {
    answer: 'Answer referencing [1].',
    validatedCitations: [
      { index: '1', chunkId: 'chunk-1', parentChunkId: 'parent-1' },
    ],
    hallucinated: [],
    unusedCitations: [],
  };

  beforeEach(async () => {
    mockQueryService = { buildPlan: jest.fn().mockReturnValue(mockPlan) };
    mockExecutionService = {
      execute: jest.fn().mockResolvedValue(mockContexts),
    };
    mockParentExpansionService = {
      expand: jest.fn().mockResolvedValue(mockParents),
    };
    mockContextAssemblyService = {
      assemble: jest.fn().mockReturnValue(mockAssembled),
    };
    mockCitationBoundaryService = {
      build: jest.fn().mockReturnValue({
        units: mockUnits,
        citationMap: mockCitationMap,
        totalTokens: 100,
      }),
    };
    mockPromptFormattingService = {
      format: jest.fn().mockReturnValue(mockPrompt),
    };
    mockCitationValidationService = {
      validate: jest.fn().mockReturnValue(mockValidationResult),
    };
    mockLlm = { generate: jest.fn().mockResolvedValue(mockLlmResponse) };
    mockAppConfig = {
      llmProvider: 'openai',
      llmModel: 'gpt-4o-mini',
      ragTokenBudget: 6000,
    };
    mockLogger = { info: jest.fn(), error: jest.fn(), warn: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RagOrchestratorService,
        { provide: QueryService, useValue: mockQueryService },
        { provide: RetrievalExecutionService, useValue: mockExecutionService },
        {
          provide: ParentExpansionService,
          useValue: mockParentExpansionService,
        },
        {
          provide: ContextAssemblyService,
          useValue: mockContextAssemblyService,
        },
        {
          provide: CitationBoundaryService,
          useValue: mockCitationBoundaryService,
        },
        {
          provide: PromptFormattingService,
          useValue: mockPromptFormattingService,
        },
        {
          provide: CitationValidationService,
          useValue: mockCitationValidationService,
        },
        { provide: AIService, useValue: mockLlm },
        { provide: AppConfigService, useValue: mockAppConfig },
        {
          provide: getLoggerToken(RagOrchestratorService.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<RagOrchestratorService>(RagOrchestratorService);
  });

  afterEach(() => jest.clearAllMocks());

  // ----------------------------------------------------------------
  // Pipeline ordering
  // ----------------------------------------------------------------
  describe('pipeline ordering', () => {
    it('calls all pipeline stages in the correct sequence', async () => {
      const callOrder: string[] = [];

      mockQueryService.buildPlan.mockImplementation(() => {
        callOrder.push('buildPlan');
        return mockPlan;
      });
      mockExecutionService.execute.mockImplementation(async () => {
        callOrder.push('execute');
        return mockContexts;
      });
      mockParentExpansionService.expand.mockImplementation(async () => {
        callOrder.push('expand');
        return mockParents;
      });
      mockContextAssemblyService.assemble.mockImplementation(() => {
        callOrder.push('assemble');
        return mockAssembled;
      });
      mockCitationBoundaryService.build.mockImplementation(() => {
        callOrder.push('build');
        return {
          units: mockUnits,
          citationMap: mockCitationMap,
          totalTokens: 100,
        };
      });
      mockPromptFormattingService.format.mockImplementation(() => {
        callOrder.push('format');
        return mockPrompt;
      });
      mockLlm.generate.mockImplementation(async () => {
        callOrder.push('generate');
        return mockLlmResponse;
      });
      mockCitationValidationService.validate.mockImplementation(() => {
        callOrder.push('validate');
        return mockValidationResult;
      });

      await service.query({
        tenantId: 'tenant-1',
        query: 'what is RAG?',
        topK: 10,
      });

      expect(callOrder).toEqual([
        'buildPlan',
        'execute',
        'expand',
        'assemble',
        'build',
        'format',
        'generate',
        'validate',
      ]);
    });
  });

  // ----------------------------------------------------------------
  // Correct arguments passed between stages
  // ----------------------------------------------------------------
  describe('argument passing', () => {
    it('passes plan to execution service', async () => {
      await service.query({
        tenantId: 'tenant-1',
        query: 'what is RAG?',
        topK: 10,
      });

      expect(mockExecutionService.execute).toHaveBeenCalledWith(mockPlan);
    });

    it('passes contexts and tenantId to parent expansion service', async () => {
      await service.query({
        tenantId: 'tenant-1',
        query: 'what is RAG?',
        topK: 10,
      });

      expect(mockParentExpansionService.expand).toHaveBeenCalledWith(
        mockContexts,
        'tenant-1',
      );
    });

    it('passes parents and token budget to context assembly', async () => {
      await service.query({
        tenantId: 'tenant-1',
        query: 'what is RAG?',
        topK: 10,
      });

      expect(mockContextAssemblyService.assemble).toHaveBeenCalledWith({
        parents: mockParents,
        tokenBudget: 6000,
      });
    });

    it('passes rawAnswerText and citationMap to citation validation', async () => {
      await service.query({
        tenantId: 'tenant-1',
        query: 'what is RAG?',
        topK: 10,
      });

      expect(mockCitationValidationService.validate).toHaveBeenCalledWith({
        rawAnswer: mockLlmResponse.content,
        citationMap: mockCitationMap,
      });
    });
  });

  // ----------------------------------------------------------------
  // Response shape
  // ----------------------------------------------------------------
  describe('response shape', () => {
    it('returns answer, citations, and meta from validation result', async () => {
      const result = await service.query({
        tenantId: 'tenant-1',
        query: 'what is RAG?',
        topK: 10,
      });

      expect(result).toEqual({
        answer: mockValidationResult.answer,
        citations: mockValidationResult.validatedCitations,
        meta: {
          hallucinatedCitations: mockValidationResult.hallucinated,
          unusedCitations: mockValidationResult.unusedCitations,
        },
      });
    });
  });

  // ----------------------------------------------------------------
  // Error propagation
  // ----------------------------------------------------------------
  describe('error propagation', () => {
    it('propagates error when retrieval execution fails', async () => {
      mockExecutionService.execute.mockRejectedValue(
        new Error('retrieval failed'),
      );

      await expect(
        service.query({
          tenantId: 'tenant-1',
          query: 'what is RAG?',
          topK: 10,
        }),
      ).rejects.toThrow('retrieval failed');
    });

    it('propagates error when LLM generation fails', async () => {
      mockLlm.generate.mockRejectedValue(new Error('LLM timeout'));

      await expect(
        service.query({
          tenantId: 'tenant-1',
          query: 'what is RAG?',
          topK: 10,
        }),
      ).rejects.toThrow('LLM timeout');
    });
  });
});
