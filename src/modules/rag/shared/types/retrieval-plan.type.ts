import { RetrievalQuery } from './retrieval-query.type';

export type RetrievalPlan = {
  tenantId: string;
  query: string;
  topK: number;

  strategy: 'hybrid' | 'vector-only' | 'lexical-only';

  // Carried through, unchanged from the incoming RetrievalQuery.
  // QueryService decides how to retrieve, not "what scope" is
  // allowed — that's the caller's responsibility, and it must
  // survive into the plan rather than getting silently dropped.
  filters?: RetrievalQuery['filters'];

  options: {
    enableParentExpansion: boolean;
    enableRank: boolean;
    minimumVectorScore?: number;
  };
};
