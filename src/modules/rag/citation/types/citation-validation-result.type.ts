import { CitationIndexMap } from '../../citation-boundaries/interfaces/citation-boundary.interface';

export type ValidatedCitation = {
  index: string; // "1", "2" — the ID the LLM used
  chunkId: string;
  parentChunkId: string;
};

export type CitationValidationResult = {
  answer: string;
  validatedCitations: ValidatedCitation[];
  hallucinated: string[]; // IDs the LLM referenced that don't exist in the map
  unusedCitations: string[]; // IDs in the map the LLM never referenced
};
