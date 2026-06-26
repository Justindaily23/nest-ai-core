import { Test, TestingModule } from '@nestjs/testing';
import { getLoggerToken } from 'nestjs-pino';
import { PdfCodec } from './pdf.codec';
import { PdfParser } from './pdf.parser';
import { PdfSectionBuilder } from './pdf.section-builder';
import { IngestionExtractionError } from '../../ingestion-errors'; // Aligned pathing
import { IngestionInput } from '../../ingestion-input';

// Mock the underlying pdf-parse v2 module at the global file layer
const mockGetText = jest.fn();
const mockDestroy = jest.fn();

jest.mock('pdf-parse', () => {
  return {
    PDFParse: jest.fn().mockImplementation(() => {
      return {
        getText: mockGetText,
        destroy: mockDestroy,
      };
    }),
  };
});

// ----------------------------------------------------------------
// PdfSectionBuilder — pure logic, no dependencies
// ----------------------------------------------------------------
describe('PdfSectionBuilder', () => {
  let builder: PdfSectionBuilder;

  beforeEach(() => {
    builder = new PdfSectionBuilder();
  });

  it('splits text into sections on double newlines', () => {
    const sections = builder.build(
      'first section\n\nsecond section',
      'source-1',
    );

    expect(sections).toHaveLength(2);
    expect(sections[0].rawText).toBe('first section');
    expect(sections[1].rawText).toBe('second section');
  });

  it('filters out empty sections after trimming', () => {
    const sections = builder.build('valid\n\n   \n\nalso valid', 'source-1');

    expect(sections).toHaveLength(2);
  });

  it('assigns sequential structuralPath to each section', () => {
    const sections = builder.build('one\n\ntwo\n\nthree', 'source-1');

    expect(sections.map((s) => s.structuralPath)).toEqual([
      'section.0',
      'section.1',
      'section.2',
    ]);
  });

  it('returns empty array for empty text', () => {
    const sections = builder.build('', 'source-1');
    expect(sections).toEqual([]);
  });
});

// ----------------------------------------------------------------
// PdfParser — wraps pdf-parse v2, validated parameters
// ----------------------------------------------------------------
describe('PdfParser', () => {
  let parser: PdfParser;
  let mockLogger: {
    debug: jest.Mock;
    warn: jest.Mock;
    error: jest.Mock;
    info: jest.Mock;
  };

  const testInput: IngestionInput = {
    tenantId: 'tenant-1',
    filename: 'test.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('%PDF-1.5 test contents'),
  };

  beforeEach(async () => {
    mockLogger = {
      debug: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      info: jest.fn(),
    };
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfParser,
        {
          provide: getLoggerToken(PdfParser.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    parser = module.get<PdfParser>(PdfParser);
  });

  it('throws IngestionExtractionError when the underlying v2 engine fails', async () => {
    // Force the internal method hook to fail
    mockGetText.mockRejectedValue(
      new Error('Corrupted layout matrix processing failure'),
    );

    await expect(parser.parse(testInput)).rejects.toThrow(
      IngestionExtractionError,
    );
    expect(mockDestroy).toHaveBeenCalledTimes(1); // Verifies the finally block handles leakage
  });
});

// ----------------------------------------------------------------
// PdfCodec — orchestration layer validation
// ----------------------------------------------------------------
describe('PdfCodec', () => {
  let codec: PdfCodec;
  let mockParser: { parse: jest.Mock };
  let mockSectionBuilder: { build: jest.Mock };
  let mockLogger: { debug: jest.Mock; info: jest.Mock; warn: jest.Mock };

  const baseInput: IngestionInput = {
    tenantId: 'tenant-1',
    filename: 'test.pdf',
    mimeType: 'application/pdf',
    buffer: Buffer.from('fake pdf content'),
  };

  // ✅ Aligned property values matching v2 outputs ('numPages')
  const mockParsed = { text: 'section one\n\nsection two', numPages: 2 };
  const mockSections = [
    { sectionId: 'id-1', rawText: 'section one', structuralPath: 'section.0' },
    { sectionId: 'id-2', rawText: 'section two', structuralPath: 'section.1' },
  ];

  beforeEach(async () => {
    mockParser = { parse: jest.fn().mockResolvedValue(mockParsed) };
    mockSectionBuilder = { build: jest.fn().mockReturnValue(mockSections) };
    mockLogger = { debug: jest.fn(), info: jest.fn(), warn: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PdfCodec,
        { provide: PdfParser, useValue: mockParser },
        { provide: PdfSectionBuilder, useValue: mockSectionBuilder },
        {
          provide: getLoggerToken(PdfCodec.name),
          useValue: mockLogger,
        },
      ],
    }).compile();

    codec = module.get<PdfCodec>(PdfCodec);
  });

  afterEach(() => jest.clearAllMocks());

  describe('supports()', () => {
    it('returns true for application/pdf', () => {
      expect(codec.supports(baseInput)).toBe(true);
    });

    it('returns false for text/plain', () => {
      expect(codec.supports({ ...baseInput, mimeType: 'text/plain' })).toBe(
        false,
      );
    });
  });

  describe('extract()', () => {
    it('returns a CanonicalDocument with correct shape', async () => {
      const result = await codec.extract(baseInput);

      expect(result).toMatchObject({
        tenantId: 'tenant-1',
        mimeType: 'application/pdf',
        sections: mockSections,
        metadata: expect.objectContaining({
          pageCount: 2,
          filename: 'test.pdf',
        }),
      });
    });

    it('passes the complete invariant envelope object directly into the parser', async () => {
      await codec.extract(baseInput);

      // Asserts envelope validation rather than separate params
      expect(mockParser.parse).toHaveBeenCalledWith(baseInput);
    });

    it('uses hints.sourceId as sourceId when provided inside the payload envelope', async () => {
      await codec.extract({
        ...baseInput,
        hints: { sourceId: 'real-db-uuid' },
      });

      expect(mockSectionBuilder.build).toHaveBeenCalledWith(
        mockParsed.text,
        'real-db-uuid',
      );
    });
  });
});
