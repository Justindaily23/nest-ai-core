import { Injectable } from '@nestjs/common';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { IngestionInput } from '../../ingestion-input';
import { ParsedPdf } from '../interface/parsedPdf.interface';
import { PDFParse } from 'pdf-parse';
import { IngestionExtractionError } from '../../ingestion-errors';
import { LayoutStrategy } from '../interface/ingestion-strategies.constants';

@Injectable()
export class PdfParser {
  constructor(
    @InjectPinoLogger(PdfParser.name) private readonly logger: PinoLogger,
  ) {}

  async parse(input: IngestionInput): Promise<ParsedPdf> {
    const { buffer, tenantId, filename, hints } = input;
    const parser = new PDFParse({ data: buffer });

    try {
      this.logger.info(
        { tenantId, filename, strategy: hints?.layoutStrategy },
        'Executing PDF layout extraction stream',
      );
      const result = await parser.getText();

      const isOcrForced = hints?.layoutStrategy === LayoutStrategy.OCR_FORCED;

      // Scanned PDF detection — text layer is empty despite pages existing.
      // All major PDF libraries have this limitation; fail loud rather than
      // producing empty sections that look like successful extraction.
      if (!isOcrForced && !result.text?.trim() && result.total > 0) {
        this.logger.warn(
          { tenantId, filename, pageCount: result.total },
          'PdfParser: PDF appears to be scanned (no text layer) — OCR required',
        );
        throw new IngestionExtractionError(
          `PDF "${filename}" contains no extractable text. It may be a scanned document requiring OCR.`,
        );
      }
      return {
        text: result.text,
        numPages: result.total,
      };
    } catch (error) {
      if (error instanceof IngestionExtractionError) {
        throw error;
      }
      this.logger.error(
        { tenantId, filename, err: error },
        'PdfParser: pdf-parse threw during extraction',
      );
      throw new IngestionExtractionError(`Failed to parse PDF: ${filename}`);
    } finally {
      await parser.destroy();
    }
  }
}
