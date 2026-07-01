import {
  IsString,
  IsUUID,
  IsOptional,
  IsEnum,
  IsObject,
} from 'class-validator';

export type DocumentStatus = 'pending' | 'processing' | 'completed' | 'failed';

export class CreateDocumentDto {
  @IsUUID()
  id!: string;

  @IsString()
  tenantId!: string;

  @IsString()
  sourceType!: string;

  @IsString()
  @IsOptional()
  filename?: string;

  @IsString()
  @IsOptional()
  mimeType?: string;

  @IsString()
  checksum!: string;

  @IsObject()
  @IsOptional()
  metadata?: Record<string, unknown>;
}

export class UpdateDocumentStatusDto {
  @IsString()
  tenantId!: string;

  @IsUUID()
  documentId!: string;

  @IsEnum(['pending', 'processing', 'completed', 'failed'])
  status!: DocumentStatus;

  @IsString()
  @IsOptional()
  errorMessage?: string;
}
