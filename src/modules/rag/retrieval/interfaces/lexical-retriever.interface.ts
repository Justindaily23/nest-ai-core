import { RetrievalQuery } from '../../shared/types/retrieval-query.type';
import { RetrievedContext } from '../../shared/types/retrieved-context.type';

/**
 * Keyword / metadata based retriever.
 * Uses lexical or structured database signals.
 */
export interface LexicalRetriever {
  retrieve(query: RetrievalQuery): Promise<RetrievedContext[]>;
}
