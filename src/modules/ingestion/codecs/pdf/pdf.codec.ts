import { Injectable } from '@nestjs/common';
import { IngestionCodec } from '../../ingestion-codec.interface';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { IngestionInput } from '../../ingestion-input';
import { CanonicalDocument } from '../../canonical-document';
import { PdfParser } from './pdf.parser';
import { createHash } from 'crypto';
import { PdfSectionBuilder } from './pdf.section-builder';

@Injectable()
export class PdfCodec implements IngestionCodec {
  constructor(
    private readonly parser: PdfParser,
    private readonly sectionBuilder: PdfSectionBuilder,
    @InjectPinoLogger(PdfCodec.name) private readonly logger: PinoLogger,
  ) {}

  /**
   * Supports any PDF regardless of domain hints.
   * Pure mimeType check — synchronous, no I/O.
   */
  supports(input: IngestionInput): boolean {
    return input.mimeType === 'application/pdf';
  }

  async extract(input: IngestionInput): Promise<CanonicalDocument> {
    const sourceId = this.resolveSourceId(input);

    this.logger.debug(
      {
        tenantId: input.tenantId,
        filename: input.filename,
        bufferSize: input.buffer.length,
      },
      'PdfCodec: starting extraction',
    );

    // Parse the binary buffer into raw text
    const parsed = await this.parser.parse(input);

    //Split raw text into canonical sections
    const sections = this.sectionBuilder.build(parsed.text, sourceId);
    this.logger.info(
      {
        tenantId: input.tenantId,
        filename: input.filename,
        sectionCount: sections.length,
        pageCount: parsed.numPages,
      },
      'PdfCodec: extraction complete',
    );

    return {
      tenantId: input.tenantId,
      sourceId,
      mimeType: 'application/pdf',
      sections,
      metadata: {
        pageCount: parsed.numPages,
        filename: input.filename,
        extractedAt: new Date().toISOString(),
      },
    };
  }

  /**
   * sourceId resolution order:
   * 1. hints.sourceId — the document's real DB UUID, preferred in production
   * 2. filename hash — fallback when DB row doesn't exist yet at extraction time
   *
   * Callers should always pass hints.sourceId in production so section IDs
   * are tied to the real DB identifier rather than a filename hash.
   */
  private resolveSourceId(input: IngestionInput): string {
    if (input.hints?.sourceId) {
      return input.hints.sourceId;
    }

    return createHash('sha256')
      .update(`${input.tenantId}-${input.filename}`)
      .digest('hex')
      .slice(0, 30);
  }
}
