/**
 * Single message unit compatible with an LLM
 *
 */

export interface PromptMessge {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

/**
 * Input required to format a full prompt
 */

export interface PromptFormattingInput {
  systemPrompt: String;
  userQuery: string;
  citationContext: {
    citationId: string;
    content: string;
  }[];
}

/**
 * Output payload sent to the AI provider
 */
export interface FormattedPrompt {
  messages: PromptMessge[];
}
