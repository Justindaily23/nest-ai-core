/**
 * Canonical context unit consumed by AnswerExecutionService.
 * All retrievers MUST emit this shape.
 */
export type RetrievedContext = {
  chunkId: string;
  content: string;
  score: number;

  source: {
    documentId: string;
    filename: string;
    page?: number;
  };

  signals: {
    vectorScore?: number;
    lexicalScore?: number;
  };
};
