/**
 * @file ingestion-router.service.ts
 * @description SYSTEM EXECUTION ENGINE: The Core Ingestion Strategy Router.
 *
 * DESIGN PRINCIPLE (Open/Closed Architecture):
 * This service operates purely as a centralized traffic coordinator. It remains
 * 100% closed to modifications; as you onboard new sectors (e.g., Medical, Financial),
 * you simply register new implementation classes under the `IngestionCodec` token array.
 * This file never changes.
 *
 * OBSERVABILITY STRATEGY:
 * Implements strict structured object logging using Pino. It explicitly captures the
 * contextual state (`tenantId`, `codec`, `mimeType`) as structured JSON properties,
 * entirely avoiding un-parsable log strings.
 */

import { Inject, Injectable } from '@nestjs/common';
import { PinoLogger, InjectPinoLogger } from 'nestjs-pino';
import { IngestionCodec } from '@/modules/ingestion/ingestion-codec.interface';
import { IngestionInput } from '@/modules/ingestion/ingestion-input';
import { CanonicalDocument } from '@/modules/ingestion/canonical-document';
import {
  UnsupportedIngestionFormatError,
  IngestionExtractionError,
} from '@/modules/ingestion/ingestion-errors';
import { INGESTION_CODEC_TOKEN } from './ingestion.constants';

@Injectable()
export class IngestionRouterService {
  constructor(
    @InjectPinoLogger(IngestionRouterService.name)
    private readonly logger: PinoLogger,

    /**
     * Nest will inject all registered ingestion codecs here
     * This is how we stay open/closed and allow new parsers to be added without modifying this file
     */
    @Inject(INGESTION_CODEC_TOKEN)
    private readonly codecs: IngestionCodec[],
  ) {}

  /**
   * Evaluates the raw input envelope, delegates parsing to the verified codec(data layout parser),
   * and yields the invariant CanonicalDocument payload.
   *
   * @throws UnsupportedIngestionFormatError If no matching parsing strategy exists.
   * @throws IngestionExtractionError If the parsing strategy crashes during execution.
   */
  async ingest(input: IngestionInput): Promise<CanonicalDocument> {
    const codec = this.codecs.find((c) => c.supports(input));

    if (!codec) {
      this.logger.warn({
        tenantId: input.tenantId,
        mimeType: input.mimeType,
        filename: input.filename,
        message: 'No ingestion codec found to process document layout',
      });
      throw new UnsupportedIngestionFormatError();
    }

    const codecName = codec.constructor.name;

    try {
      this.logger.debug({
        codec: codecName,
        tenentId: input.tenantId,
        filename: input.filename,
        mimeType: input.mimeType,
        message: 'Document extraction codec selected',
      });

      return await codec.extract(input);
    } catch (error) {
      this.logger.error({
        err: error,
        codec: codec.constructor.name,
        tenantId: input.tenantId,
        Message: 'Codec Extraction Failed',
      });

      throw new IngestionExtractionError();
    }
  }
}
