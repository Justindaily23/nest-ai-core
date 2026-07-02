import {
  BadRequestException,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
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
import { createHash } from 'crypto';
import { extname } from 'node:path';
import { LayoutStrategy } from './codecs/interface/ingestion-strategies.constants';
import type { MultipartFile } from '@fastify/multipart';
import { v5 as uuidv5 } from 'uuid';
import { DocumentStatus } from '@/modules/rag/persistence/repositories/interfaces/document-repository.interface';

const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024;

const NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const DOCUMENT_STATUS_MESSAGES: Record<DocumentStatus, string> = {
  pending:
    'Document accepted. Waiting in line for background worker processing.',
  processing:
    'Parser completed. Actively generating AI vector embeddings with OpenAI.',
  completed:
    'Vector generation successful. Document is fully indexed and ready for RAG searches.',
  failed: 'Processing halted due to a background operational error.',
};
interface MultipartFastifyRequest extends FastifyRequest {
  file(options?: {
    limits?: { fileSize?: number };
  }): Promise<MultipartFile | undefined>;
  isMultipart(): boolean;
}

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
  async upload(@Req() req: MultipartFastifyRequest): Promise<UploadResponse> {
    if (!req.isMultipart()) {
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

    /**
     * PRODUCTION SAFE DETERMINISTIC ID:
     * Generates a fully formal, RFC-compliant UUIDv5 based on tenantId and checksum.
     * Guaranteed to match PostgreSQL's native internal uuid parsing engine.
     */

    const documentId = uuidv5(`${tenantId}:${checksum}`, NAMESPACE);

    const isDuplicate = await this.documentRepository.existsByChecksum(
      tenantId,
      checksum,
    );

    if (isDuplicate) {
      // Fetch the existing document's status to see what state it's in
      const existingDoc = await this.documentRepository.findStatusById(
        tenantId,
        documentId,
      );

      // SHORT-CIRCUIT: If it's already fully embedded, save resources and exit immediately!
      if (existingDoc && existingDoc.status === 'completed') {
        this.logger.info(
          { tenantId, filename, checksum, documentId },
          'Document has already been successfully fully processed. Ending trip immediately.',
        );

        return {
          success: true,
          documentId,
          jobId: documentId, // Return the documentId as the jobId since no new job was created
          message: 'Document already processed and ready for use.',
        };
      }
      // RETRY FALLBACK: If it failed or is stuck in pending, reset and retry it

      this.logger.warn(
        { tenantId, filename, checksum, documentId },
        'Incomplete or existing document upload detected. Resetting status to process updates.',
      );

      // Reset the database state so the background worker knows to retry it
      await this.documentRepository.updateStatus({
        tenantId,
        documentId,
        status: 'pending',
        errorMessage: undefined,
      });

      this.logger.info(
        { tenantId, documentId, targetStatus: 'pending' },
        'Document status successfully reset to pending — proceeding to enqueue retry job',
      );
    } else {
      this.logger.info(
        { tenantId, filename, checksum, documentId },
        'New document upload detected. Proceeding with ingestion.',
      );

      /**
       * NEW DOCUMENT ROW: Create database record before enqueuing
       * Only hits if the file checksum does not yet exist for this tenant
       */
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
    }

    /**
     * ENQUEUE: Hand off to background worker
     * Buffer serialized to number[] - buffer is not json-safe
     */
    const bufferJsonArray: number[] = Array.from(buffer);

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
        { tenantId, documentId, jobId, filename },
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

  @Get(':id/status')
  @HttpCode(HttpStatus.OK)
  async getStatus(@Param('id') id: string): Promise<{
    documentId: string;
    status: string;
    message: string;
    errorMessage: string | null;
  }> {
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

    const document = await this.documentRepository.findStatusById(tenantId, id);

    if (!document) {
      throw new NotFoundException(
        'No record found for this document. The upload may have failed to initialize.',
      );
    }
    // Safely assert the DB string matches your official Union Type
    const currentStatus = document.status as DocumentStatus;

    // Dynamically pull the clean user-friendly description
    const statusMessage =
      currentStatus === 'failed' && document.errorMessage
        ? `Processing halted: ${document.errorMessage}`
        : DOCUMENT_STATUS_MESSAGES[currentStatus];

    return {
      documentId: document.id,
      status: document.status,
      message: statusMessage,
      errorMessage: document.errorMessage,
    };
  }
}
