import { Injectable } from '@nestjs/common';
import { DatabaseService } from '@core/database/database.service';
import {
  CreateDocumentParams,
  UpdateDocumentStatus,
} from './interfaces/document-repository.interface';

@Injectable()
export class DocumentRepository {
  constructor(private readonly db: DatabaseService) {}

  async insert(params: CreateDocumentParams): Promise<void> {
    await this.db.client
      .insertInto('documents')
      .values({
        id: params.id,
        tenant_id: params.tenantId,
        source_type: params.sourceType,
        filename: params.filename ?? null,
        mime_type: params.mimeType ?? null,
        checksum: params.checksum,
        metadata: params.metadata ? JSON.stringify(params.metadata) : null,
      })
      .execute();
  }

  async existsByChecksum(tenantId: string, checksum: string): Promise<boolean> {
    const result = await this.db.client
      .selectFrom('documents')
      .select('id')
      .where('tenant_id', '=', tenantId)
      .where('checksum', '=', checksum)
      .limit(1)
      .executeTakeFirst();
    return !!result;
  }

  async updateStatus(params: UpdateDocumentStatus): Promise<void> {
    const { tenantId, documentId, status, errorMessage } = params;
    await this.db.client
      .updateTable('documents')
      .set({ status: status, error_message: errorMessage ?? null })
      .where('id', '=', documentId)
      .where('tenant_id', '=', tenantId)
      .execute();
  }
}
