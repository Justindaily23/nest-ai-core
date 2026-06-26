import { Test, TestingModule } from '@nestjs/testing';
import { ContextAssemblyService } from './context-assembly.service';
import { TokenizerService } from '../../tokenization/tokenizer.service';
import { ContextAssemblyInput } from '../interfaces/context-assembly.interface';

describe('ContextAssemblyService', () => {
  let service: ContextAssemblyService;
  let mockTokenizer: jest.Mocked<
    Pick<TokenizerService, 'encode' | 'decode' | 'countTokens'>
  >;

  beforeEach(async () => {
    mockTokenizer = {
      encode: jest.fn(),
      decode: jest.fn(),
      countTokens: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContextAssemblyService,
        { provide: TokenizerService, useValue: mockTokenizer },
      ],
    }).compile();

    service = module.get<ContextAssemblyService>(ContextAssemblyService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('It should assemble context segments within the  specified token budget limit', () => {
    mockTokenizer.countTokens.mockImplementation((text: string) => text.length);

    const input: ContextAssemblyInput = {
      tokenBudget: 50,
      parents: [
        {
          parentChunkId: 'p1',
          parentContent: 'parent',
          score: 0.9,
          children: [
            { chunkId: 'c1', content: 'child-one', score: 0.9 },
            { chunkId: 'c2', content: 'child-two', score: 0.8 },
          ],
        },
      ],
    };

    const result = service.assemble(input);

    expect(result.blocks).toHaveLength(1);
    expect(result.totalTokens).toBeGreaterThan(0);
    expect(result.totalTokens).toBeLessThanOrEqual(50);
  });

  it('should immediately stop appending child rows when individual block limits break budget rules', () => {
    mockTokenizer.countTokens.mockImplementation((text: string) =>
      text === 'parent' ? 10 : 30,
    );

    const input: ContextAssemblyInput = {
      tokenBudget: 50,
      parents: [
        {
          parentChunkId: 'p1',
          parentContent: 'parent',
          score: 0.7,
          children: [
            { chunkId: 'c1', content: 'child-a', score: 0.7 }, // Fits safely: 10 + 30 = 40
            { chunkId: 'c2', content: 'child-b', score: 0.6 }, // Truncates: 40 + 30 = 70 (breaks 50 budget)
          ],
        },
      ],
    };

    const result = service.assemble(input);

    expect(result.blocks[0].children).toHaveLength(1);
    expect(result.blocks[0].children[0].chunkId).toBe('c1');
  });

  it('should drop parents from final collection entirely if they contain no valid child nodes', () => {
    mockTokenizer.countTokens.mockImplementation((text: string) =>
      text === 'parent' ? 10 : 100,
    );

    const input: ContextAssemblyInput = {
      tokenBudget: 50,
      parents: [
        {
          parentChunkId: 'p1',
          parentContent: 'parent',
          score: 0.6,
          children: [{ chunkId: 'c1', content: 'too-big', score: 0.6 }],
        },
      ],
    };

    const result = service.assemble(input);

    expect(result.blocks).toHaveLength(0);
  });

  it('should preserve structural document priority and ranking order during iteration steps', () => {
    mockTokenizer.countTokens.mockReturnValue(5);

    const input: ContextAssemblyInput = {
      tokenBudget: 100,
      parents: [
        {
          parentChunkId: 'p1',
          parentContent: 'p1',
          score: 0.9,
          children: [{ chunkId: 'c1', content: 'c1', score: 0.9 }],
        },
        {
          parentChunkId: 'p2',
          parentContent: 'p2',
          score: 0.8,
          children: [{ chunkId: 'c2', content: 'c2', score: 0.8 }],
        },
      ],
    };

    const result = service.assemble(input);

    expect(result.blocks.map((b) => b.parentChunkId)).toEqual(['p1', 'p2']);
  });

  it('returns empty result when no parents are provided', () => {
    const result = service.assemble({ parents: [], tokenBudget: 6000 });

    expect(result.blocks).toEqual([]);
    expect(result.totalTokens).toBe(0);
    expect(result.budgetTokens).toBe(6000);
  });

  it('skips parent entirely if parent content itself exceeds budget', () => {
    mockTokenizer.countTokens.mockImplementation((text: string) =>
      text === 'huge-parent' ? 200 : 10,
    );

    const input: ContextAssemblyInput = {
      tokenBudget: 100,
      parents: [
        {
          parentChunkId: 'p1',
          parentContent: 'huge-parent', // 200 tokens — exceeds budget alone
          score: 0.9,
          children: [{ chunkId: 'c1', content: 'small', score: 0.9 }],
        },
      ],
    };

    const result = service.assemble(input);

    // Parent can't fit, so nothing is assembled even though child is small
    expect(result.blocks).toEqual([]);
    expect(result.totalTokens).toBe(0);
  });

  it('stops processing parents once budget is exhausted', () => {
    mockTokenizer.countTokens.mockReturnValue(30);

    const input: ContextAssemblyInput = {
      tokenBudget: 70, // fits p1 (30 parent + 30 child = 60), p2 would need 30 more = 90, over budget
      parents: [
        {
          parentChunkId: 'p1',
          parentContent: 'p1',
          score: 0.9,
          children: [{ chunkId: 'c1', content: 'c1', score: 0.9 }],
        },
        {
          parentChunkId: 'p2',
          parentContent: 'p2',
          score: 0.8,
          children: [{ chunkId: 'c2', content: 'c2', score: 0.8 }],
        },
      ],
    };

    const result = service.assemble(input);

    expect(result.blocks).toHaveLength(1);
    expect(result.blocks[0].parentChunkId).toBe('p1');
  });

  it('budgetTokens reflects the original budget regardless of how much was used', () => {
    mockTokenizer.countTokens.mockReturnValue(5);

    const result = service.assemble({
      tokenBudget: 6000,
      parents: [
        {
          parentChunkId: 'p1',
          parentContent: 'p1',
          score: 0.9,
          children: [{ chunkId: 'c1', content: 'c1', score: 0.9 }],
        },
      ],
    });

    // totalTokens is what was used, budgetTokens is the original ceiling
    expect(result.budgetTokens).toBe(6000);
    expect(result.totalTokens).toBeLessThan(6000);
  });

  it('totalTokens equals budgetTokens minus remaining — not just child tokens', () => {
    // Parent tokens contribute to totalTokens too
    mockTokenizer.countTokens.mockImplementation((text: string) =>
      text === 'parent' ? 20 : 10,
    );

    const result = service.assemble({
      tokenBudget: 6000,
      parents: [
        {
          parentChunkId: 'p1',
          parentContent: 'parent',
          score: 0.9,
          children: [{ chunkId: 'c1', content: 'child', score: 0.9 }],
        },
      ],
    });

    // 20 (parent) + 10 (child) = 30
    expect(result.totalTokens).toBe(30);
  });
});
