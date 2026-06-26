import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { CitationValidationService } from './citation-validation.service';
import { CitationIndexMap } from '../../citation-boundaries/interfaces/citation-boundary.interface';

describe('CitationValidationService', () => {
  let service: CitationValidationService;
  let mockLogger: {
    warn: jest.Mock;
    error: jest.Mock;
    debug: jest.Mock;
  };

  beforeEach(async () => {
    mockLogger = {
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        CitationValidationService,
        {
          provide: getLoggerToken(CitationValidationService.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    service = module.get<CitationValidationService>(CitationValidationService);
  });

  const buildMap = (ids: string[]): CitationIndexMap => {
    const map: CitationIndexMap = {};
    ids.forEach((id) => {
      map[id] = { parentChunkId: `parent-${id}`, chunkId: `chunk-${id}` };
    });
    return map;
  };

  describe('valid citations', () => {
    it('validates a citation that exists in the map', () => {
      const result = service.validate({
        rawAnswer: 'The sky is blue [1].',
        citationMap: buildMap(['1']),
      });

      expect(result.validatedCitations).toEqual([
        { index: '1', chunkId: 'chunk-1', parentChunkId: 'parent-1' },
      ]);
      expect(result.hallucinated).toEqual([]);
    });

    it('validates multiple distinct citations', () => {
      const result = service.validate({
        rawAnswer: 'Fact one [1]. Fact two [2].',
        citationMap: buildMap(['1', '2']),
      });

      expect(result.validatedCitations).toHaveLength(2);
      expect(result.hallucinated).toEqual([]);
    });

    it('deduplicates repeated references to the same citation', () => {
      const result = service.validate({
        rawAnswer: 'Fact one [1]. Restated again [1].',
        citationMap: buildMap(['1']),
      });

      // Set collapses duplicate refs — only one validated entry expected
      expect(result.validatedCitations).toHaveLength(1);
    });
  });

  describe('hallucinated citations', () => {
    it('flags a citation ID not present in the map', () => {
      const result = service.validate({
        rawAnswer: 'This claims [5].',
        citationMap: buildMap(['1']),
      });

      expect(result.hallucinated).toEqual(['5']);
      expect(result.validatedCitations).toEqual([]);
      expect(mockLogger.warn).toHaveBeenCalled();
    });

    it('strips hallucinated references from the returned answer', () => {
      const result = service.validate({
        rawAnswer: 'This claims [5] something.',
        citationMap: buildMap(['1']),
      });

      expect(result.answer).toBe('This claims [INVALID REF] something.');
    });

    it('strips all occurrences of a repeated hallucinated reference', () => {
      const result = service.validate({
        rawAnswer: '[9] appears here and again [9].',
        citationMap: {},
      });

      expect(result.answer).toBe(
        '[INVALID REF] appears here and again [INVALID REF].',
      );
    });

    it('handles a mix of valid and hallucinated citations correctly', () => {
      const result = service.validate({
        rawAnswer: 'Real fact [1], fake fact [9].',
        citationMap: buildMap(['1']),
      });

      expect(result.validatedCitations).toEqual([
        { index: '1', chunkId: 'chunk-1', parentChunkId: 'parent-1' },
      ]);
      expect(result.hallucinated).toEqual(['9']);
      expect(result.answer).toBe('Real fact [1], fake fact [INVALID REF].');
    });
  });

  describe('unused citations', () => {
    it('reports citations present in the map but never referenced', () => {
      const result = service.validate({
        rawAnswer: 'Only uses [1].',
        citationMap: buildMap(['1', '2', '3']),
      });

      expect(result.unusedCitations.sort()).toEqual(['2', '3']);
    });

    it('reports no unused citations when all are referenced', () => {
      const result = service.validate({
        rawAnswer: '[1] and [2].',
        citationMap: buildMap(['1', '2']),
      });

      expect(result.unusedCitations).toEqual([]);
    });
  });

  describe('edge cases', () => {
    it('returns empty results when the answer has no citation references', () => {
      const result = service.validate({
        rawAnswer: 'No citations in this answer at all.',
        citationMap: buildMap(['1']),
      });

      expect(result.validatedCitations).toEqual([]);
      expect(result.hallucinated).toEqual([]);
      expect(result.unusedCitations).toEqual(['1']);
      expect(result.answer).toBe('No citations in this answer at all.');
    });

    it('handles an empty citationMap with citations referenced (all hallucinated)', () => {
      const result = service.validate({
        rawAnswer: 'Claims [1] and [2].',
        citationMap: {},
      });

      expect(result.hallucinated.sort()).toEqual(['1', '2']);
      expect(result.validatedCitations).toEqual([]);
    });

    it('handles an empty rawAnswer', () => {
      const result = service.validate({
        rawAnswer: '',
        citationMap: buildMap(['1']),
      });

      expect(result.validatedCitations).toEqual([]);
      expect(result.hallucinated).toEqual([]);
      expect(result.unusedCitations).toEqual(['1']);
      expect(result.answer).toBe('');
    });

    it('does not match non-numeric bracketed text', () => {
      const result = service.validate({
        rawAnswer: 'This is [not a citation] and [also-not-one].',
        citationMap: buildMap(['1']),
      });

      expect(result.validatedCitations).toEqual([]);
      expect(result.hallucinated).toEqual([]);
    });

    it('correctly distinguishes multi-digit citation IDs (regression: [1] vs [11])', () => {
      const result = service.validate({
        rawAnswer: 'References [1] and [11] separately.',
        citationMap: buildMap(['1', '11']),
      });

      expect(result.validatedCitations).toHaveLength(2);
      expect(result.validatedCitations.map((c) => c.index).sort()).toEqual([
        '1',
        '11',
      ]);
    });

    it('stripping [1] does not corrupt [11] in the answer text', () => {
      const result = service.validate({
        rawAnswer: 'Bad ref [9] and unrelated [99] reference.',
        citationMap: {},
      });

      // Both are hallucinated and independently stripped — neither
      // replacement should bleed into the other's brackets.
      expect(result.answer).toBe(
        'Bad ref [INVALID REF] and unrelated [INVALID REF] reference.',
      );
    });
  });

  describe('logging behavior', () => {
    it('logs an error when hallucinated citations are found', () => {
      service.validate({
        rawAnswer: 'Fake [9].',
        citationMap: {},
      });

      expect(mockLogger.error).toHaveBeenCalled();
    });

    it('does not log an error when there are no hallucinated citations', () => {
      service.validate({
        rawAnswer: 'Real [1].',
        citationMap: buildMap(['1']),
      });

      expect(mockLogger.error).not.toHaveBeenCalled();
    });

    it('logs debug info when unused citations exist', () => {
      service.validate({
        rawAnswer: 'Uses [1] only.',
        citationMap: buildMap(['1', '2']),
      });

      expect(mockLogger.debug).toHaveBeenCalled();
    });
  });
});
