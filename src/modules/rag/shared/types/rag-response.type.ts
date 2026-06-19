import { ValidatedCitation } from '../../citation/types/citation-validation-result.type';

export type RagResponse = {
  answer: string;
  citations: ValidatedCitation[];
  meta: {
    hallucinatedCitations: string[];
    unusedCitations: string[];
  };
};
