import { Test, TestingModule } from '@nestjs/testing';
import { PromptFormattingService } from './prompt-formatting.service';
import { PromptFormattingInput } from '../interfaces/prompt-formatting.interface';

describe('PromptFormattingService', () => {
  let service: PromptFormattingService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [PromptFormattingService],
    }).compile();

    service = module.get<PromptFormattingService>(PromptFormattingService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // Test 1: Security Guarantee (Sanitization)
  it('should strip malicious control characters from source content', () => {
    const input: PromptFormattingInput = {
      systemPrompt: 'You are a helpful assistant.',
      userQuery: 'What is the budget?',
      citationContext: [
        {
          citationId: '1',
          content: 'Budget is \x00$50k\x1F.', // Contains hidden control characters
        },
      ],
    };

    const result = service.format(input);
    const userMessage = result.messages.find((m) => m.role === 'user')?.content;

    expect(userMessage).toContain('Budget is $50k.');
    expect(userMessage).not.toContain('\x00');
    expect(userMessage).not.toContain('\x1F');
  });

  // Test 2: Invariant Guarantee (Hard Ceiling)
  it('should strictly truncate source content exceeding 4000 characters', () => {
    const hugeContent = 'A'.repeat(5000);
    const input: PromptFormattingInput = {
      systemPrompt: 'You are a helpful assistant.',
      userQuery: 'Summarize.',
      citationContext: [{ citationId: '1', content: hugeContent }],
    };

    const result = service.format(input);
    const userMessage = result.messages.find((m) => m.role === 'user')?.content;

    // The formatted string will contain headers, but the core text segment must be capped
    expect(userMessage).toContain(
      '[SOURCE 1]\n' + 'A'.repeat(4000) + '\n[END SOURCE]',
    );
    expect(userMessage).not.toContain('A'.repeat(4001));
  });

  // Test 3: Structural Format Verification
  it('should assemble SDK-compliant system instructions and deterministic user turns', () => {
    const input: PromptFormattingInput = {
      systemPrompt: 'Base instruction.',
      userQuery: 'My question.',
      citationContext: [{ citationId: 'ALPHA', content: 'Valid data slice.' }],
    };

    const result = service.format(input);

    expect(result.messages).toHaveLength(2);
    expect(result.messages[0]).toEqual({
      role: 'system',
      content: expect.stringContaining(
        'Base instruction.\n\nYou will be given retrieved source documents',
      ),
    });
    expect(result.messages[1]).toEqual({
      role: 'user',
      content: expect.stringContaining(
        '[SOURCE ALPHA]\nValid data slice.\n[END SOURCE]\n--- END SOURCES ---\n\nQuery: My question.',
      ),
    });
  });
});
