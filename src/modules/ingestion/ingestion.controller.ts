import {
  BadRequestException,
  Controller,
  HttpCode,
  HttpStatus,
  Post,
  Req,
} from '@nestjs/common';
import { IngestionProducer } from './queue/ingestion.producer';
import { DocumentRepository } from '../rag/persistence/repositories/document.repository';
import { ContextService } from '@/common/context/context.service';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import type { FastifyRequest } from 'fastify';
import { UploadResponse } from './interface/upload-response.interface';
import { OperationalException } from '@/common/exceptions/operational.exception';
import { ALLOWED_MIME_TYPES } from './types/ingestion-mimeTypes.type';
import { createHash, randomUUID } from 'crypto';
import { extname } from 'node:path';
import { LayoutStrategy } from './codecs/interface/ingestion-strategies.constants';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

@Controller('documents')
export class IngestionController {
  constructor(
    private readonly ingestionProducer: IngestionProducer,
    private readonly documentRepository: DocumentRepository,
    private readonly contextService: ContextService,
    @InjectPinoLogger(IngestionController.name)
    private readonly logger: PinoLogger,
  ) {}

  @Post('uploads')
  @HttpCode(HttpStatus.ACCEPTED)
  async upload(@Req() req: FastifyRequest): Promise<UploadResponse> {
    // Guard: Request must be multipart
    const contentType = req.headers['content-type'] || '';
    if (!contentType.includes('multipart/form-data')) {
      throw new BadRequestException('Request must be multipart/form-data.');
    }

    // PARSE: Extract file from multipart stream
    const data = await req.file({ limits: { fileSize: MAX_FILE_SIZE_BYTES } });

    if (!data) {
      throw new BadRequestException('No file found. Field name must be file.');
    }

    // Guard: Mime type allowist
    const { filename, mimetype } = data;

    if (!ALLOWED_MIME_TYPES.includes(mimetype)) {
      throw new BadRequestException(
        `Unsupported file type: ${mimetype}. Accepted: ${ALLOWED_MIME_TYPES.join(', ')}`,
      );
    }

    /**
     * BUFFER: consume the stream into memory
     * Must happen after MIME check - no point buffering a file to be rejected
     */
    const buffer = await data.toBuffer();

    if (buffer.length > MAX_FILE_SIZE_BYTES) {
      throw new BadRequestException(
        `File too large. Maximum allowed size is ${(MAX_FILE_SIZE_BYTES / 1024 / 1024).toFixed(0)}MB.`,
      );
    }

    if (buffer.length === 0) {
      throw new BadRequestException('Uploaded file is empty');
    }

    /**
     * IDENTITY: Resolve tenant from executioni context
     * Never to trust tenantID coming from request body or headers
     */
    const context = this.contextService.get();
    const tenantId = context.tenant?.id;

    if (!tenantId) {
      throw new OperationalException(
        'auth',
        'TENANT_NOT_RESOLVED',
        'Tenant could not be resolved from execution context.',
        HttpStatus.UNAUTHORIZED,
      );
    }

    /**
     * DEDUPLICATION: SHA-256 checksum of raw buffer
     * Computed here so the databas check happens before any
     * document row is created  or job is enqueued
     */
    const checksum = createHash('sha256').update(buffer).digest('hex');

    const isDuplicate = await this.documentRepository.existsByChecksum(
      tenantId,
      checksum,
    );

    if (isDuplicate) {
      this.logger.warn(
        { tenantId, filename: data.filename, checksum },
        'Duplicate document upload rejected',
      );
      throw new BadRequestException(
        'This file has already been ingested. Duplicate uploads are not permitted.',
      );
    }

    /**
     * DOCUMENT ROW: Create dtabase record  before enqueuing
     * Status starts as 'pending' - worker updates from here
     */
    const documentId = randomUUID();
    const derivedSourceType = filename
      ? extname(filename).toLowerCase().replace('.', '')
      : mimetype.split('/')[1] || 'unknown';
    const sourceType = derivedSourceType || 'unknown';

    await this.documentRepository.insert({
      id: documentId,
      tenantId,
      sourceType,
      filename,
      mimeType: mimetype,
      checksum,
      metadata: {
        originalSize: buffer.length,
        uploadedAt: new Date().toISOString(),
      },
    });

    this.logger.debug(
      {
        tenantId,
        documentId,
        filename,
        size: buffer.length,
        mimeType: mimetype,
      },
      'Document record created — enqueuing ingestion job',
    );

    /**
     * ENQUEUE: Hand off to background worker
     * Buffer serialized to number[] - buffer is not json-safe
     */
    const bufferJsonArray = Array.from(buffer);

    let jobId: string;
    try {
      jobId = await this.ingestionProducer.enqueue({
        documentId,
        filename,
        mimeType: mimetype,
        buffer: bufferJsonArray,
        hints: {
          sourceId: documentId,
          layoutStrategy: LayoutStrategy.NATIVE_TEXT_ONLY,
        },
      });

      this.logger.info(
        { tenantId, documentId, jobId, filename: data.filename },
        'Document upload accepted and queued for ingestion',
      );
    } catch (error) {
      if (error instanceof Error) {
        this.logger.error(
          { error: error.message, tenantId, documentId },
          'Ingestion queue dispatch failed',
        );
      }
      // Enqueue failed — mark document as failed so it doesn't
      // sit as 'pending' forever with no worker picking it up
      await this.documentRepository.updateStatus({
        tenantId,
        documentId,
        status: 'failed',
        errorMessage:
          error instanceof Error
            ? error.message
            : 'Failed to enqueue ingestion job',
      });

      throw new OperationalException(
        'system',
        'INGESTION_ENQUEUE_FAILED',
        'Failed to queue document for processing.',
        HttpStatus.INTERNAL_SERVER_ERROR,
        error,
      );
    }

    return {
      success: true,
      documentId,
      jobId,
      message:
        'Document accepted for processing. Check status using the documentId.',
    };
  }
}
