export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';
export interface CreateDocumentParams {
  id: string;
  tenantId: string;
  sourceType: string;
  filename?: string;
  mimeType?: string;
  checksum: string;
  metadata?: Record<string, unknown>;
}
export interface UpdateDocumentStatus {
  tenantId: string;
  documentId: string;
  status: DocumentStatus;
  errorMessage?: string;
}
