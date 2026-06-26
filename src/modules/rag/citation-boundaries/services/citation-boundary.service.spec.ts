import { Test, TestingModule } from '@nestjs/testing';
import { CitationBoundaryService } from './citation-boundary.service';
import { AssembledContext } from '../../context-assembly/interfaces/context-assembly.interface';

describe('CitationBoundaryService', () => {
  let service: CitationBoundaryService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [CitationBoundaryService],
    }).compile();

    service = module.get<CitationBoundaryService>(CitationBoundaryService);
  });

  // ----------------------------------------------------------------
  // Helpers
  // ----------------------------------------------------------------
  const buildContext = (
    blocks: {
      parentChunkId: string;
      children: { chunkId: string; content: string; tokens: number }[];
    }[],
  ): AssembledContext => ({
    totalTokens: blocks
      .flatMap((b) => b.children)
      .reduce((sum, c) => sum + c.tokens, 0),
    budgetTokens: 6000,
    blocks: blocks.map((b) => ({
      parentChunkId: b.parentChunkId,
      parentContent: 'parent content',
      children: b.children,
      totalTokens: b.children.reduce((sum, c) => sum + c.tokens, 0),
      score: 1,
    })),
  });

  // ----------------------------------------------------------------
  // Core behavior
  // ----------------------------------------------------------------
  describe('citation ID assignment', () => {
    it('assigns sequential IDs starting from 1', () => {
      const context = buildContext([
        {
          parentChunkId: 'parent-1',
          children: [
            { chunkId: 'chunk-1', content: 'Content A', tokens: 10 },
            { chunkId: 'chunk-2', content: 'Content B', tokens: 20 },
          ],
        },
      ]);

      const { units } = service.build(context);

      expect(units[0].citationId).toBe('1');
      expect(units[1].citationId).toBe('2');
    });

    it('is deterministic — same input always produces same IDs', () => {
      const context = buildContext([
        {
          parentChunkId: 'parent-1',
          children: [{ chunkId: 'chunk-1', content: 'Content A', tokens: 10 }],
        },
      ]);

      const first = service.build(context);
      const second = service.build(context);

      expect(first.units[0].citationId).toBe(second.units[0].citationId);
      expect(first.citationMap).toEqual(second.citationMap);
    });

    it('assigns IDs across multiple blocks sequentially', () => {
      const context = buildContext([
        {
          parentChunkId: 'parent-1',
          children: [{ chunkId: 'chunk-1', content: 'A', tokens: 10 }],
        },
        {
          parentChunkId: 'parent-2',
          children: [
            { chunkId: 'chunk-2', content: 'B', tokens: 10 },
            { chunkId: 'chunk-3', content: 'C', tokens: 10 },
          ],
        },
      ]);

      const { units } = service.build(context);

      expect(units.map((u) => u.citationId)).toEqual(['1', '2', '3']);
    });
  });

  describe('citationMap correctness', () => {
    it('maps each citation ID to the correct chunkId and parentChunkId', () => {
      const context = buildContext([
        {
          parentChunkId: 'parent-1',
          children: [{ chunkId: 'chunk-1', content: 'Content A', tokens: 10 }],
        },
      ]);

      const { citationMap } = service.build(context);

      expect(citationMap['1']).toEqual({
        chunkId: 'chunk-1',
        parentChunkId: 'parent-1',
      });
    });

    it('each unit citationId has a corresponding entry in citationMap', () => {
      const context = buildContext([
        {
          parentChunkId: 'parent-1',
          children: [
            { chunkId: 'chunk-1', content: 'A', tokens: 10 },
            { chunkId: 'chunk-2', content: 'B', tokens: 20 },
          ],
        },
      ]);

      const { units, citationMap } = service.build(context);

      for (const unit of units) {
        expect(citationMap[unit.citationId]).toBeDefined();
      }
    });

    it('does not leak chunkId or parentChunkId into prompt-facing units', () => {
      const context = buildContext([
        {
          parentChunkId: 'parent-1',
          children: [{ chunkId: 'chunk-1', content: 'Content A', tokens: 10 }],
        },
      ]);

      const { units } = service.build(context);

      // Units are what goes into the prompt — DB keys must not appear here
      expect(units[0]).not.toHaveProperty('chunkId');
      expect(units[0]).not.toHaveProperty('parentChunkId');
      expect(units[0]).not.toHaveProperty('documentId');
    });
  });

  describe('token accounting', () => {
    it('totalTokens matches the sum of all child tokens', () => {
      const context = buildContext([
        {
          parentChunkId: 'parent-1',
          children: [
            { chunkId: 'chunk-1', content: 'A', tokens: 15 },
            { chunkId: 'chunk-2', content: 'B', tokens: 25 },
          ],
        },
      ]);

      const { totalTokens } = service.build(context);

      expect(totalTokens).toBe(40);
    });
  });

  describe('edge cases', () => {
    it('returns empty result for null context', () => {
      const result = service.build(null as any);

      expect(result).toEqual({ units: [], totalTokens: 0, citationMap: {} });
    });

    it('returns empty result for context with no blocks', () => {
      const result = service.build({
        totalTokens: 0,
        budgetTokens: 6000,
        blocks: [],
      });

      expect(result).toEqual({ units: [], totalTokens: 0, citationMap: {} });
    });

    it('skips blocks with no children', () => {
      const context: AssembledContext = {
        totalTokens: 0,
        budgetTokens: 6000,
        blocks: [
          {
            parentChunkId: 'parent-1',
            parentContent: 'content',
            children: [],
            totalTokens: 0,
            score: 1,
          },
        ],
      };

      const { units, citationMap } = service.build(context);

      expect(units).toEqual([]);
      expect(citationMap).toEqual({});
    });

    it('skips children with missing content', () => {
      const context: AssembledContext = {
        totalTokens: 0,
        budgetTokens: 6000,
        blocks: [
          {
            parentChunkId: 'parent-1',
            parentContent: 'content',
            children: [
              { chunkId: 'chunk-1', content: '', tokens: 0 },
              { chunkId: 'chunk-2', content: 'valid', tokens: 10 },
            ],
            totalTokens: 10,
            score: 1,
          },
        ],
      };

      const { units } = service.build(context);

      // Only the valid child gets a citation ID
      expect(units).toHaveLength(1);
      expect(units[0].citationId).toBe('1');
    });

    it('IDs remain sequential even when children are skipped', () => {
      const context: AssembledContext = {
        totalTokens: 0,
        budgetTokens: 6000,
        blocks: [
          {
            parentChunkId: 'parent-1',
            parentContent: 'content',
            children: [
              { chunkId: 'chunk-1', content: '', tokens: 0 }, // skipped
              { chunkId: 'chunk-2', content: 'valid', tokens: 10 }, // gets [1]
              { chunkId: 'chunk-3', content: 'also valid', tokens: 10 }, // gets [2]
            ],
            totalTokens: 20,
            score: 1,
          },
        ],
      };

      const { units } = service.build(context);

      expect(units[0].citationId).toBe('1');
      expect(units[1].citationId).toBe('2');
    });
  });
});
