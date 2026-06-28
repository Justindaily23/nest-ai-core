import { JobEnvelope } from '@/core/queue/job-envelop';
import { IngestionDomain } from '@/common/types/domain.types';
import { LayoutStrategy } from '../codecs/interface/ingestion-strategies.constants';

export interface IngestionJobData {
  documentId: string;
  filename: string;
  mimeType: string;
  buffer: number[];
  hints?: {
    domain?: IngestionDomain; // e.g 'medical', generic
    layoutStrategy?: LayoutStrategy; // e.g 'ocr-forced', 'hybrid-layout', 'native-text-only'
    sourceId?: string;
  };
}

//The actual job type  that travels through redis
export type IngestionJob = JobEnvelope<IngestionJobData>;
