/**
 * Context Assembly inteface
 *
 * This layer converts retrieved + expanded chunks into a token-budgeted deterministic context structure
 * suitable for prompt construction and citation
 *
 */

import { ParentExpandedChunk } from '@modules/rag/retrieval/interfaces/retrieval-repository.interface';

export interface ContextAssemblyInput {
  parents: ParentExpandedChunk[]; // // The full list of text results from your database
  tokenBudget: number; // The maximum number of tokens allowed
}

export interface AssembledContext {
  totalTokens: number; // Exactly how many tokens we used in total
  budgetTokens: number; // The original budget limit respected
  blocks: ContextBlock[]; // Fianl sorted list of blocks that successfully fit inside the budget
}

export interface ContextBlock {
  parentChunkId: string; //The unique id of the main document
  parentContent: string; // The actual text of the main document

  // The specific paragraph pulled from this document
  children: {
    chunkId: string;
    content: string;
    tokens: number; // Exactly how many tokens this small paragraph costs
  }[];

  totalTokens: number; // combined token cost of the parent + children
  score: number; // inherited parent score ( how relevant this document is)
}
