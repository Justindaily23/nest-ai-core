import { CitationIndexMap } from '../../citation-boundaries/interfaces/citation-boundary.interface';

/**
 * Everything citation validation needs.
 * citationMap is the ground truth — built before the LLM was called.
 * rawAnswer is what the LLM actually said — not trusted until validated.
 */

export type CitationValidationInput = {
  rawAnswer: string;
  citationMap: CitationIndexMap;
};
