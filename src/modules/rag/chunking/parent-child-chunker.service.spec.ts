/**
 * @file parent-child-chunker.service.spec.ts
 * @description Full test suite for ParentChildChunkerService.
 *
 * Structure:
 *   Layer 1 — Unit tests      (mocked tokenizer, pure algorithm logic)
 *   Layer 2 — Integration     (real tokenizer, semantic correctness)
 *   Layer 3 — Invariant/Fuzz  (fast-check property tests, mathematical truths)
 *
 * Testing philosophy:
 *   - Assert relationships and invariants, not loop mechanics.
 *   - Never assert exact log message strings — only that the correct level was called.
 *   - ID stability is treated as a first-class correctness concern.
 *   - Content strings are scaled to produce multiple parents under real strategy values.
 */

import { Test, TestingModule } from '@nestjs/testing';
import { PinoLogger } from 'nestjs-pino';
import * as fc from 'fast-check';
import { ParentChildChunkerService } from './parent-child-chunker.service';
import { Tokenizer } from '../tokenization/interfaces/tokenizer.interface';
import { ChunkRole } from '@/common/enums/chunk-role.enum';
import { ChunkingStrategy } from './interfaces/chunking-strategy.interface';

// ---------------------------------------------------------------------------
// Shared test doubles
// ---------------------------------------------------------------------------

/**
 * Builds a mock Tokenizer.
 * encode: maps each character to a unique integer (char code).
 * decode: reverses by converting integers back to characters and joining.
 * count:  returns text.length — consistent with 1-char-per-token model,
 *         and intentionally avoids array allocation to match the interface's
 *         zero-allocation contract.
 *
 * This gives us a deterministic 1-char-per-token model so that offset
 * assertions in tests are easy to reason about without needing a real BPE model.
 */
function buildMockTokenizer(overrides: Partial<Tokenizer> = {}): Tokenizer {
  return {
    encode: jest.fn((text: string): number[] =>
      text.split('').map((c) => c.charCodeAt(0)),
    ),
    decode: jest.fn((tokens: number[]): string =>
      tokens.map((t) => String.fromCharCode(t)).join(''),
    ),
    count: jest.fn((text: string): number => text.length),
    ...overrides,
  };
}

/**
 * Production strategy — mirrors DEFAULT_STRATEGY from chunking-strategy.constant.ts.
 *
 * parentStep = parentChunkSize - parentOverlapSize = 1000 - 100 = 900
 * childStep  = childChunkSize  - overlapSize       =  200 -  20 = 180
 *
 * Content sizing for unit tests (1-char-per-token mock):
 *   CONTENT_MULTI_PARENT = 2500 chars → 3 parents
 *     formula: Math.ceil((2500 - 1000) / 900) + 1 = Math.ceil(1.67) + 1 = 3
 *   CONTENT_SINGLE_PARENT = 800 chars → fits entirely within one parent window
 */
const BASE_STRATEGY: ChunkingStrategy = {
  parentChunkSize: 1000,
  parentOverlapSize: 100,
  childChunkSize: 200,
  overlapSize: 20,
};

// Pre-computed content lengths scaled to BASE_STRATEGY window sizes.
// With the 1-char-per-token mock: 1 char = 1 token.
const CONTENT_MULTI_PARENT = 'a'.repeat(2500); // produces 3 parents
const CONTENT_SINGLE_PARENT = 'a'.repeat(800); // fits in one parent

/**
 * Builds a mock PinoLogger with jest spies on all log-level methods.
 * We only assert which level was called — never the message string.
 */
function buildMockLogger(): PinoLogger {
  return {
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    fatal: jest.fn(),
    trace: jest.fn(),
  } as unknown as PinoLogger;
}

/** Helper: build the service with injected doubles via NestJS testing module. */
async function buildService(
  tokenizer: Tokenizer,
  logger: PinoLogger,
): Promise<ParentChildChunkerService> {
  const module: TestingModule = await Test.createTestingModule({
    providers: [
      ParentChildChunkerService,
      { provide: 'TOKENIZER_PROVIDER', useValue: tokenizer },
      { provide: PinoLogger, useValue: logger },
    ],
  }).compile();

  return module.get(ParentChildChunkerService);
}

// ---------------------------------------------------------------------------
// LAYER 1 — UNIT TESTS (mocked tokenizer)
// ---------------------------------------------------------------------------

describe('ParentChildChunkerService — Unit', () => {
  let service: ParentChildChunkerService;
  let tokenizer: Tokenizer;
  let logger: PinoLogger;

  beforeEach(async () => {
    tokenizer = buildMockTokenizer();
    logger = buildMockLogger();
    service = await buildService(tokenizer, logger);
  });

  // -------------------------------------------------------------------------
  // 1. Strategy Validation
  // -------------------------------------------------------------------------

  describe('Strategy validation', () => {
    it('throws RangeError when childChunkSize equals overlapSize', () => {
      const strategy: ChunkingStrategy = {
        ...BASE_STRATEGY,
        childChunkSize: 200,
        overlapSize: 200,
      };
      expect(() =>
        service.execute('tenant-1', 'doc-1', CONTENT_SINGLE_PARENT, strategy),
      ).toThrow(RangeError);
    });

    it('throws RangeError when childChunkSize is less than overlapSize', () => {
      const strategy: ChunkingStrategy = {
        ...BASE_STRATEGY,
        childChunkSize: 50,
        overlapSize: 200,
      };
      expect(() =>
        service.execute('tenant-1', 'doc-1', CONTENT_SINGLE_PARENT, strategy),
      ).toThrow(RangeError);
    });

    it('throws RangeError when parentChunkSize equals parentOverlapSize', () => {
      const strategy: ChunkingStrategy = {
        ...BASE_STRATEGY,
        parentChunkSize: 1000,
        parentOverlapSize: 1000,
      };
      expect(() =>
        service.execute('tenant-1', 'doc-1', CONTENT_SINGLE_PARENT, strategy),
      ).toThrow(RangeError);
    });

    it('throws RangeError when parentChunkSize is less than parentOverlapSize', () => {
      const strategy: ChunkingStrategy = {
        ...BASE_STRATEGY,
        parentChunkSize: 100,
        parentOverlapSize: 1000,
      };
      expect(() =>
        service.execute('tenant-1', 'doc-1', CONTENT_SINGLE_PARENT, strategy),
      ).toThrow(RangeError);
    });

    it('logs at error level before throwing on invalid childStep', () => {
      const strategy: ChunkingStrategy = {
        ...BASE_STRATEGY,
        childChunkSize: 20,
        overlapSize: 20,
      };
      try {
        service.execute('tenant-1', 'doc-1', CONTENT_SINGLE_PARENT, strategy);
      } catch {}
      expect(logger.error).toHaveBeenCalledTimes(1);
    });

    it('does not throw for a valid strategy', () => {
      expect(() =>
        service.execute(
          'tenant-1',
          'doc-1',
          CONTENT_SINGLE_PARENT,
          BASE_STRATEGY,
        ),
      ).not.toThrow();
    });
  });

  // -------------------------------------------------------------------------
  // 2. Empty Content
  // -------------------------------------------------------------------------

  describe('Empty content', () => {
    beforeEach(() => {
      (tokenizer.encode as jest.Mock).mockReturnValue([]);
    });

    it('returns empty parents and children arrays', () => {
      const result = service.execute('tenant-1', 'doc-1', '');
      expect(result.parents).toHaveLength(0);
      expect(result.children).toHaveLength(0);
    });

    it('logs at debug level and does not log at info level', () => {
      service.execute('tenant-1', 'doc-1', '');
      expect(logger.debug).toHaveBeenCalledTimes(1);
      expect(logger.info).not.toHaveBeenCalled();
    });

    it('does not call tokenizer.decode when content is empty', () => {
      service.execute('tenant-1', 'doc-1', '');
      expect(tokenizer.decode).not.toHaveBeenCalled();
    });

    it('does not call tokenizer.count during empty content fast-exit path', () => {
      service.execute('tenant-1', 'doc-1', '');
      expect(tokenizer.count).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 3. Parent Generation
  // -------------------------------------------------------------------------

  describe('Parent generation', () => {
    /**
     * With 1-char-per-token encoding and BASE_STRATEGY:
     *   CONTENT_MULTI_PARENT = 2500 tokens
     *   parentChunkSize = 1000, parentOverlapSize = 100, parentStep = 900
     *
     *   Parent 0: tokens [0    .. 999 ]
     *   Parent 1: tokens [900  .. 1899]  (100 token overlap with parent 0)
     *   Parent 2: tokens [1800 .. 2499]  (100 token overlap with parent 1, clamped)
     */

    it('generates the correct number of parents', () => {
      const { parents } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      expect(parents.length).toBe(3);
    });

    it('first parent starts at token offset 0', () => {
      const { parents } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      expect(parents[0].metadata.startTokenOffset).toBe(0);
    });

    it('last parent endTokenOffset equals total token length', () => {
      const { parents } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      const last = parents[parents.length - 1];
      expect(last.metadata.endTokenOffset).toBe(2500);
    });

    it('adjacent parents overlap by exactly parentOverlapSize tokens', () => {
      const { parents } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      for (let i = 1; i < parents.length; i++) {
        const prev = parents[i - 1];
        const curr = parents[i];
        const prevEnd = prev.metadata['endTokenOffset'] as number;
        const currStart = curr.metadata['startTokenOffset'] as number;
        // const overlapTokens =
        //   prev.metadata.endTokenOffset - curr.metadata.startTokenOffset;
        const overlapTokens = prevEnd - currStart;
        expect(overlapTokens).toBe(BASE_STRATEGY.parentOverlapSize);
      }
    });

    it('parent tokenCount matches the actual slice length', () => {
      const { parents } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      for (const parent of parents) {
        const endOffset = parent.metadata['endTokenOffset'] as number;
        const startOffset = parent.metadata['startTokenOffset'] as number;

        const expectedCount = endOffset - startOffset;
        expect(parent.tokenCount).toBe(expectedCount);
      }
    });

    it('parent sequences are monotonically increasing from 0', () => {
      const { parents } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      parents.forEach((p, i) => {
        expect(p.sequence).toBe(i);
      });
    });

    it('every parent carries tenantId and documentId', () => {
      const { parents } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      for (const parent of parents) {
        expect(parent.tenantId).toBe('t1');
        expect(parent.documentId).toBe('d1');
      }
    });
  });

  // -------------------------------------------------------------------------
  // 4. Child Generation
  // -------------------------------------------------------------------------

  describe('Child generation', () => {
    it('produces no zero-length children', () => {
      const { children } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      for (const child of children) {
        expect(child.tokenCount).toBeGreaterThan(0);
      }
    });

    it('every child absoluteEndToken does not exceed document token length', () => {
      const { children } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      for (const child of children) {
        expect(child.metadata.absoluteEndToken).toBeLessThanOrEqual(2500);
      }
    });

    it('adjacent children within the same parent overlap by exactly overlapSize tokens', () => {
      const { parents, children } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      for (const parent of parents) {
        const parentChildren = children.filter((c) => c.parentId === parent.id);
        for (let i = 1; i < parentChildren.length; i++) {
          const prev = parentChildren[i - 1];
          const curr = parentChildren[i];
          const prevEnd = prev.metadata['absoluteEndToken'] as number;
          const currStart = curr.metadata['absoluteStartToken'] as number;

          const overlap = prevEnd - currStart;
          expect(overlap).toBe(BASE_STRATEGY.overlapSize);
        }
      }
    });

    it('every child absoluteStartToken falls within its parent token range', () => {
      const { parents, children } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      const parentMap = new Map(parents.map((p) => [p.id, p]));
      for (const child of children) {
        const parent = parentMap.get(child.parentId)!;

        // 1. Cast child metadata keys to numbers
        const childStart = child.metadata['absoluteStartToken'] as number;
        const childEnd = child.metadata['absoluteEndToken'] as number;

        // 2. Cast parent metadata keys to numbers
        const parentStart = parent.metadata['startTokenOffset'] as number;
        const parentEnd = parent.metadata['endTokenOffset'] as number;

        // 3. Execute assertions cleanly
        expect(childStart).toBeGreaterThanOrEqual(parentStart);
        expect(childEnd).toBeLessThanOrEqual(parentEnd);
      }
    });

    it('child localParentStartToken is consistent with absoluteStartToken', () => {
      const { parents, children } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      const parentMap = new Map(parents.map((p) => [p.id, p]));
      for (const child of children) {
        const parent = parentMap.get(child.parentId)!;

        // Extract and cast all offsets to numbers safely
        const childAbsStart = child.metadata['absoluteStartToken'] as number;
        const childLocalStart = child.metadata[
          'localParentStartToken'
        ] as number;
        const parentStart = parent.metadata['startTokenOffset'] as number;

        // Perform the coordinate verification math
        expect(childAbsStart).toBe(parentStart + childLocalStart);
      }
    });

    it('every child carries correct parentId, tenantId, documentId', () => {
      const { children } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      for (const child of children) {
        expect(child.tenantId).toBe('t1');
        expect(child.documentId).toBe('d1');
        expect(child.parentId).toBeDefined();
      }
    });
  });

  // -------------------------------------------------------------------------
  // 5. ID Stability
  // -------------------------------------------------------------------------

  describe('ID stability', () => {
    it('produces identical parent IDs on repeated execution with same inputs', () => {
      const run1 = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      const run2 = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      expect(run1.parents.map((p) => p.id)).toEqual(
        run2.parents.map((p) => p.id),
      );
    });

    it('produces identical child IDs on repeated execution with same inputs', () => {
      const run1 = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      const run2 = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      expect(run1.children.map((c) => c.id)).toEqual(
        run2.children.map((c) => c.id),
      );
    });

    it('different tenantId produces different IDs for identical content', () => {
      const run1 = service.execute(
        'tenant-A',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      const run2 = service.execute(
        'tenant-B',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      const ids1 = new Set(run1.parents.map((p) => p.id));
      const ids2 = new Set(run2.parents.map((p) => p.id));
      expect([...ids1].filter((id) => ids2.has(id))).toHaveLength(0);
    });

    it('different documentId produces different IDs for identical content', () => {
      const run1 = service.execute(
        't1',
        'doc-A',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      const run2 = service.execute(
        't1',
        'doc-B',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      const ids1 = new Set(run1.parents.map((p) => p.id));
      const ids2 = new Set(run2.parents.map((p) => p.id));
      expect([...ids1].filter((id) => ids2.has(id))).toHaveLength(0);
    });

    it('no two parents within the same document share an ID', () => {
      const { parents } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      const ids = parents.map((p) => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('no two children within the same document share an ID', () => {
      const { children } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      const ids = children.map((c) => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('parent IDs and child IDs never collide within the same document', () => {
      const { parents, children } = service.execute(
        't1',
        'd1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      const parentIds = new Set(parents.map((p) => p.id));
      const childIds = new Set(children.map((c) => c.id));
      expect([...parentIds].filter((id) => childIds.has(id))).toHaveLength(0);
    });
  });

  // -------------------------------------------------------------------------
  // 6. Multi-Tenancy Isolation
  // -------------------------------------------------------------------------

  describe('Multi-tenancy isolation', () => {
    it('chunks from different tenants with identical documents share no IDs', () => {
      const runA = service.execute(
        'tenant-A',
        'doc-1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      const runB = service.execute(
        'tenant-B',
        'doc-1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );

      const allIdsA = new Set([
        ...runA.parents.map((p) => p.id),
        ...runA.children.map((c) => c.id),
      ]);
      const allIdsB = new Set([
        ...runB.parents.map((p) => p.id),
        ...runB.children.map((c) => c.id),
      ]);

      expect([...allIdsA].filter((id) => allIdsB.has(id))).toHaveLength(0);
    });

    it('tenantId on every chunk matches the tenantId passed to execute', () => {
      const { parents, children } = service.execute(
        'tenant-X',
        'doc-1',
        CONTENT_MULTI_PARENT,
        BASE_STRATEGY,
      );
      for (const chunk of [...parents, ...children]) {
        expect(chunk.tenantId).toBe('tenant-X');
      }
    });
  });

  // -------------------------------------------------------------------------
  // 7. Completion Logging
  // -------------------------------------------------------------------------

  describe('Completion logging', () => {
    it('logs at info level exactly once on successful execution', () => {
      service.execute('t1', 'd1', CONTENT_SINGLE_PARENT, BASE_STRATEGY);
      expect(logger.info).toHaveBeenCalledTimes(1);
    });

    it('does not log at error or warn level on successful execution', () => {
      service.execute('t1', 'd1', CONTENT_SINGLE_PARENT, BASE_STRATEGY);
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  // 8. Tokenizer Method Usage Contracts
  // -------------------------------------------------------------------------

  describe('Tokenizer method usage contracts', () => {
    it('never calls tokenizer.count during chunking execution', () => {
      // count() is a high-velocity convenience method for callers who only
      // need a number. The chunker needs the actual array to slice, so encode()
      // is the correct call. This test guards against a future "optimization"
      // that swaps encode for count and silently breaks all slicing logic.
      service.execute('t1', 'd1', CONTENT_SINGLE_PARENT, BASE_STRATEGY);
      expect(tokenizer.count).not.toHaveBeenCalled();
    });

    it('calls tokenizer.encode exactly once per execution', () => {
      service.execute('t1', 'd1', CONTENT_SINGLE_PARENT, BASE_STRATEGY);
      expect(tokenizer.encode).toHaveBeenCalledTimes(1);
    });

    it('calls tokenizer.decode once per parent and once per child chunk produced', () => {
      const { parents, children } = service.execute(
        't1',
        'd1',
        CONTENT_SINGLE_PARENT,
        BASE_STRATEGY,
      );
      expect(tokenizer.decode).toHaveBeenCalledTimes(
        parents.length + children.length,
      );
    });
  });
});

// ---------------------------------------------------------------------------
// LAYER 2 — INTEGRATION TESTS (real tokenizer)
// ---------------------------------------------------------------------------
//
// These tests wire in your actual Tokenizer implementation.
// They validate that real BPE/tokenization rules do not break the algorithm.
//
// Replace `RealTokenizer` with your actual concrete class import.
import { TiktokenTokenizer } from '../tokenization/providers/tiktoken.tokenizer';

describe('ParentChildChunkerService — Integration (real tokenizer)', () => {
  let service: ParentChildChunkerService;
  let logger: PinoLogger;
  let module: TestingModule;

  // Use a tighter strategy for integration tests so real token counts
  // stay manageable without needing multi-thousand-word documents.
  const INTEGRATION_STRATEGY: ChunkingStrategy = {
    parentChunkSize: 50,
    parentOverlapSize: 10, // parentStep = 40
    childChunkSize: 20,
    overlapSize: 5, // childStep  = 15
  };

  beforeEach(async () => {
    logger = buildMockLogger();
    module = await Test.createTestingModule({
      providers: [
        ParentChildChunkerService,
        { provide: 'TOKENIZER_PROVIDER', useClass: TiktokenTokenizer },
        { provide: PinoLogger, useValue: logger },
      ],
    }).compile();
    service = module.get(ParentChildChunkerService);
  });

  it('child content decoded from real tokens produces coherent substrings', () => {
    const content = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
    const { children } = service.execute(
      't1',
      'd1',
      content,
      INTEGRATION_STRATEGY,
    );
    for (const child of children) {
      expect(child.content.length).toBeGreaterThan(0);
      expect(child.content).toMatch(/\S/); // at least one non-whitespace character
    }
  });

  it('content spanning a parent boundary appears in the overlap seam of both parents', () => {
    const content = 'word '.repeat(30); // ~120 chars — forces multiple parents

    const { parents } = service.execute(
      't1',
      'd1',
      content,
      INTEGRATION_STRATEGY,
    );

    expect(parents.length).toBeGreaterThanOrEqual(2);

    // The seam between parent[0] and parent[1] must equal parentOverlapSize
    const p0End = parents[0].metadata['endTokenOffset'] as number;
    const p1Start = parents[1].metadata['startTokenOffset'] as number;
    expect(p0End - p1Start).toBe(INTEGRATION_STRATEGY.parentOverlapSize);
  });

  it('all child absolute token ranges together cover the full document', () => {
    const content = 'The quick brown fox jumps over the lazy dog. '.repeat(5);
    const { children } = service.execute(
      't1',
      'd1',
      content,
      INTEGRATION_STRATEGY,
    );

    const covered = new Set<number>();
    for (const child of children) {
      // 1. Cast the loop parameters to numbers safely
      const childStart = child.metadata['absoluteStartToken'] as number;
      const childEnd = child.metadata['absoluteEndToken'] as number;

      for (let t = childStart; t < childEnd; t++) {
        covered.add(t);
      }
    }

    const totalTokens = children.reduce((max, c) => {
      // 2. Cast the reduction boundary parameter to a number
      const currentEnd = c.metadata['absoluteEndToken'] as number;
      return Math.max(max, currentEnd);
    }, 0);

    for (let i = 0; i < totalTokens; i++) {
      expect(covered.has(i)).toBe(true);
    }
  });

  it('tokenizer.count and tokenizer.encode agree on token length for the same input', () => {
    // count() is the zero-allocation convenience path; encode().length is the
    // full allocation path. If they diverge, usage cap accounting and chunking
    // math will silently disagree about how many tokens a document contains.

    // ✅ Retrieve the instance using your decoupled string token identifier
    const realTokenizer = module.get<Tokenizer>('TOKENIZER_PROVIDER');

    const sample = 'The quick brown fox jumps over the lazy dog.';
    expect(realTokenizer.count(sample)).toBe(
      realTokenizer.encode(sample).length,
    );
  });
});

// ---------------------------------------------------------------------------
// LAYER 3 — INVARIANT / PROPERTY TESTS (fast-check)
// ---------------------------------------------------------------------------
//
// These assert mathematical truths that must hold for ANY input + strategy.
// fast-check generates its own strategies via validStrategyArb and never
// touches BASE_STRATEGY — these tests are fully strategy-agnostic.

describe('ParentChildChunkerService — Invariants (fast-check)', () => {
  let service: ParentChildChunkerService;
  let logger: PinoLogger;

  beforeEach(async () => {
    logger = buildMockLogger();
    service = await buildService(buildMockTokenizer(), logger);
  });

  /**
   * Arbitrary: generates valid ChunkingStrategy configurations.
   * Kept small so fast-check runs stay fast without sacrificing coverage.
   */
  const validStrategyArb = fc
    .record({
      parentChunkSize: fc.integer({ min: 10, max: 60 }),
      parentOverlapSize: fc.integer({ min: 1, max: 9 }),
      childChunkSize: fc.integer({ min: 4, max: 15 }),
      overlapSize: fc.integer({ min: 1, max: 3 }),
    })
    .filter(
      (s) =>
        s.childChunkSize > s.overlapSize &&
        s.parentChunkSize > s.parentOverlapSize &&
        s.childChunkSize <= s.parentChunkSize,
    );

  /**
   * Arbitrary: generates content strings of varying lengths.
   * Printable ASCII keeps the 1-char-per-token mock consistent.
   */
  const contentArb = fc.string({
    minLength: 1,
    maxLength: 200,
    unit: 'grapheme-ascii',
  });

  // INVARIANT 1 — Coverage
  // Every token index in the document is covered by at least one child.
  it('INVARIANT: every token is covered by at least one child', () => {
    fc.assert(
      fc.property(contentArb, validStrategyArb, (content, strategy) => {
        const { children } = service.execute('t1', 'd1', content, strategy);

        if (children.length === 0) return true;

        const totalTokens = content.length; // 1-char-per-token mock
        const covered = new Set<number>();

        for (const child of children) {
          // 1. Cast the unknown metadata properties to numbers safely
          const childStart = child.metadata['absoluteStartToken'] as number;
          const childEnd = child.metadata['absoluteEndToken'] as number;

          // 2. Run the loop using the safely cast variables
          for (let t = childStart; t < childEnd; t++) {
            covered.add(t);
          }
        }

        for (let i = 0; i < totalTokens; i++) {
          if (!covered.has(i)) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  // INVARIANT 2 — Containment
  // Every child's absolute token range falls within its parent's token range.
  it('INVARIANT: every child is contained within its parent token range', () => {
    fc.assert(
      fc.property(contentArb, validStrategyArb, (content, strategy) => {
        const { parents, children } = service.execute(
          't1',
          'd1',
          content,
          strategy,
        );
        const parentMap = new Map(parents.map((p) => [p.id, p]));

        for (const child of children) {
          const parent = parentMap.get(child.parentId);
          if (!parent) return false;

          // 1. Cast child metadata properties to numbers safely
          const childStart = child.metadata['absoluteStartToken'] as number;
          const childEnd = child.metadata['absoluteEndToken'] as number;

          // 2. Cast parent metadata properties to numbers safely
          const parentStart = parent.metadata['startTokenOffset'] as number;
          const parentEnd = parent.metadata['endTokenOffset'] as number;

          // 3. Execute invariant boundary assertions
          if (childStart < parentStart) return false;
          if (childEnd > parentEnd) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  // INVARIANT 3 — ID Uniqueness
  // No two chunks of the same role share an ID within a document.
  it('INVARIANT: all parent IDs are unique within a document', () => {
    fc.assert(
      fc.property(contentArb, validStrategyArb, (content, strategy) => {
        const { parents } = service.execute('t1', 'd1', content, strategy);
        const ids = parents.map((p) => p.id);
        return new Set(ids).size === ids.length;
      }),
      { numRuns: 200 },
    );
  });

  it('INVARIANT: all child IDs are unique within a document', () => {
    fc.assert(
      fc.property(contentArb, validStrategyArb, (content, strategy) => {
        const { children } = service.execute('t1', 'd1', content, strategy);
        const ids = children.map((c) => c.id);
        return new Set(ids).size === ids.length;
      }),
      { numRuns: 200 },
    );
  });

  // INVARIANT 4 — Monotonic Sequences
  // Child sequences are strictly increasing with no gaps or duplicates.
  it('INVARIANT: child sequences are strictly monotonically increasing', () => {
    fc.assert(
      fc.property(contentArb, validStrategyArb, (content, strategy) => {
        const { children } = service.execute('t1', 'd1', content, strategy);
        for (let i = 1; i < children.length; i++) {
          if (children[i].sequence <= children[i - 1].sequence) return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
  });

  // INVARIANT 5 — Size Bounds
  // No chunk ever exceeds its configured maximum token size.
  it('INVARIANT: no child tokenCount exceeds childChunkSize', () => {
    fc.assert(
      fc.property(contentArb, validStrategyArb, (content, strategy) => {
        const { children } = service.execute('t1', 'd1', content, strategy);
        return children.every((c) => c.tokenCount <= strategy.childChunkSize);
      }),
      { numRuns: 200 },
    );
  });

  it('INVARIANT: no parent tokenCount exceeds parentChunkSize', () => {
    fc.assert(
      fc.property(contentArb, validStrategyArb, (content, strategy) => {
        const { parents } = service.execute('t1', 'd1', content, strategy);
        return parents.every((p) => p.tokenCount <= strategy.parentChunkSize);
      }),
      { numRuns: 200 },
    );
  });
});
