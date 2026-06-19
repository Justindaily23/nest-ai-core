import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { CitationValidationInput } from '../types/citation-validation-input.type';
import {
  CitationValidationResult,
  ValidatedCitation,
} from '../types/citation-validation-result.type';

@Injectable()
export class CitationValidationService {
  constructor(
    @InjectPinoLogger(CitationValidationService.name)
    private readonly logger: PinoLogger,
  ) {}

  validate(input: CitationValidationInput): CitationValidationResult {
    const { rawAnswer, citationMap } = input;

    /**
     * Parses citation references from LLM output.
     * Matches only strict numeric references like [1].
     */
    const referenced = this.parseReferences(rawAnswer.trim());

    const validatedCitations: ValidatedCitation[] = [];
    const hallucinated: string[] = [];

    for (const index of referenced) {
      const entry = citationMap[index];

      if (!entry) {
        // LLM referenced an ID that was never in the map.
        // This is a hallucinated citation — log and collect, do not pass downstream.
        this.logger.warn(
          { index, availableIds: Object.keys(citationMap) },
          'Hallucinated citation detected — LLM referenced an ID not in citation map',
        );
        hallucinated.push(index);
        continue;
      }

      validatedCitations.push({
        index,
        chunkId: entry.chunkId,
        parentChunkId: entry.parentChunkId,
      });
    }

    // Citations in the map the LLM never used.
    // Not an error — just useful signal for observability and future reranking.
    const unusedCitations = Object.keys(citationMap).filter(
      (id) => !referenced.has(id),
    );

    if (unusedCitations.length > 0) {
      this.logger.debug(
        { unusedCitations },
        'Retrieved chunks not referenced in answer',
      );
    }

    if (hallucinated.length > 0) {
      this.logger.error(
        { hallucinated, tenantId: undefined },
        'Answer contains hallucinated citations — stripping before returning',
      );
    }

    // Strip hallucinated references from the answer text before returning.
    // A hallucinated [5] becomes [INVALID] so downstream rendering
    // knows something was removed rather than seeing a broken reference.
    const answer = this.stripHallucinated(rawAnswer, hallucinated);

    return {
      answer,
      validatedCitations,
      hallucinated,
      unusedCitations,
    };
  }

  /**
   * Parses citation references from LLM output.
   * Matches [1] .
   * Returns a Set so duplicate references are collapsed automatically.
   */
  private parseReferences(text: string): Set<string> {
    const refs = new Set<string>();
    const pattern = /\[(\d+)\]/g;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(text)) !== null) {
      refs.add(match[1]);
    }

    return refs;
  }

  /**
   * Replaces hallucinated citation references with [INVALID REF].
   * Handles [N]
   */
  private stripHallucinated(text: string, hallucinated: string[]): string {
    if (!hallucinated.length) return text;

    let result = text;
    for (const id of hallucinated) {
      result = result.replace(new RegExp(`\\[${id}\\]`, 'g'), '[INVALID REF]');
    }

    return result;
  }
}
