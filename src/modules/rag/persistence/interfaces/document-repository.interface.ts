export interface CreateDocumentParams {
  id: string;
  tenantId: string;
  sourceType: string;
  filename?: string;
  mimeType?: string;
  checksum: string;
  metadata?: Record<string, unknown>;
}
