import { Processor } from '@nestjs/bullmq';
import { INGESTION_QUEUE_NAME } from './ingestion-queue.constants';
import { BaseWorker } from '@/core/queue/base-worker';
import { IngestionJobData } from './ingestion-job.types';
import { IngestionRouterService } from '../ingest-router.service';
import { ParentChildChunkerService } from '@/modules/rag/chunking/parent-child-chunker.service';
import { EmbeddingService } from '@/modules/rag/embeddings/services/embedding.service';
import { ChunkRepository } from '@/modules/rag/persistence/repositories/chunk.repository';
import { DocumentRepository } from '@/modules/rag/persistence/repositories/document.repository';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { Job } from 'bullmq';
import { JobEnvelope } from '@/core/queue/job-envelop';
import { CreateChunkParams } from '@/modules/rag/persistence/repositories/interfaces/chunk-repository.interface';
import { CanonicalDocument } from '../canonical-document';
import { DEFAULT_STRATEGY } from '@/modules/rag/chunking/constants/chunking-strategy.constant';
import { ChunkRole } from '@/common/enums/chunk-role.enum';

@Processor(INGESTION_QUEUE_NAME)
export class IngestionWorker extends BaseWorker<IngestionJobData> {
  private readonly EMBEDDING_MODEL = 'text-embedding-3-small';

  constructor(
    private readonly ingestionRouter: IngestionRouterService,
    private readonly chunker: ParentChildChunkerService,
    private readonly embeddingService: EmbeddingService,
    private readonly chunkRepository: ChunkRepository,
    private readonly documentRepository: DocumentRepository,
    @InjectPinoLogger(IngestionWorker.name) private readonly logger: PinoLogger,
  ) {
    super();
  }

  protected async handle(
    job: Job<JobEnvelope<IngestionJobData>>,
    payload: IngestionJobData,
  ): Promise<void> {
    /**
     * JobContextRunner boots ContextStore.get()
     * WE destructure the tenant Id from the restored context, not the payload
     */
    const { documentId, filename, mimeType, buffer, hints } = payload;

    // tenant Id from context not payload
    const tenantId = job.data.context.tenant?.id;

    if (!tenantId) throw new Error('Missing Tenant_ID in job context');

    this.logger.info(
      {
        jobId: job.id,
        tenantId,
        documentId,
        filename,
        attempt: job.attemptsMade + 1,
      },
      'Ingestion job started',
    );

    await this.documentRepository.updateStatus({
      tenantId,
      documentId,
      status: 'processing',
    });

    try {
      // Hydrate the serialized JSON number array back into a high-performance binary Buffer for downstream parsers.
      const fileBuffer = Buffer.from(buffer);

      //Stage 1 - extract
      const canonicalDocument: CanonicalDocument =
        await this.ingestionRouter.ingest({
          tenantId,
          filename,
          mimeType,
          buffer: fileBuffer,
          hints: { ...hints, sourceId: documentId },
        });

      this.logger.debug(
        {
          tenantId,
          documentId,
          sectionCount: canonicalDocument.sections.length,
        },
        'Stage 1 complete: document extracted',
      );

      // Stage 2 -  chunk
      const allChunkParams: CreateChunkParams[] = [];

      for (const section of canonicalDocument.sections) {
        if (!section.rawText.trim()) continue;

        const { parents, children } = this.chunker.execute(
          tenantId,
          documentId,
          section.rawText,
          DEFAULT_STRATEGY,
        );

        parents.forEach((parent, index) => {
          allChunkParams.push({
            id: parent.id,
            tenantId: parent.tenantId,
            sourceId: documentId,
            role: ChunkRole.PARENT,
            content: parent.content,
            tokenCount: parent.tokenCount,
            position: index,
            parentChunkId: null,
            metadata: parent.metadata,
          });
        });

        children.forEach((child, index) => {
          allChunkParams.push({
            id: child.id,
            tenantId: child.tenantId,
            sourceId: documentId,
            role: ChunkRole.CHILD,
            content: child.content,
            tokenCount: child.tokenCount,
            position: index,
            parentChunkId: child.parentId,
            metadata: child.metadata,
          });
        });
      }

      this.logger.debug(
        {
          tenantId,
          documentId,
          totalChunks: allChunkParams.length,
          parents: allChunkParams.filter((c) => c.role === ChunkRole.PARENT)
            .length,
          children: allChunkParams.filter((c) => c.role === ChunkRole.CHILD)
            .length,
        },
        'Stage 2 complete: chunks generated',
      );

      // Stage 3: Persist
      await this.chunkRepository.insertMany(allChunkParams);

      this.logger.debug(
        { tenantId, documentId },
        'Stage 3 complete: chunks persisted',
      );

      // STAGE 4: Embed child chunks
      const childChunks = allChunkParams.filter(
        (c) => c.role === ChunkRole.CHILD,
      );

      for (const child of childChunks) {
        await this.embeddingService.embedChunk({
          tenantId: child.tenantId,
          chunkId: child.id,
          content: child.content,
          model: this.EMBEDDING_MODEL,
        });
      }

      this.logger.debug(
        { tenantId, documentId, embeddedChunks: childChunks.length },
        'Stage 4 complete: embeddings generated',
      );

      // STAGE 5: Mark completed
      await this.documentRepository.updateStatus({
        tenantId,
        documentId,
        status: 'completed',
      });

      this.logger.info(
        {
          jobId: job.id,
          tenantId,
          documentId,
          totalChunks: allChunkParams.length,
          embeddedChunks: childChunks.length,
        },
        'Ingestion job completed successfully',
      );
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);

      await this.documentRepository.updateStatus({
        tenantId,
        documentId,
        status: 'failed',
        errorMessage,
      });

      this.logger.error(
        {
          jobId: job.id,
          tenantId,
          documentId,
          attempt: job.attemptsMade + 1,
          err: error,
        },
        'Ingestion job failed',
      );

      throw error;
    }
  }
}
