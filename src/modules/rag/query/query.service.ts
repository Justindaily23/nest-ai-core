import { BadRequestException, Injectable } from '@nestjs/common';
import { RetrievalQuery } from '../shared/types/retrieval-query.type';
import { RetrievalPlan } from '../shared/types/retrieval-plan.type';
import { clampTop } from '../shared/utils/clampTopK';

@Injectable()
export class QueryService {
  buildPlan(query: RetrievalQuery): RetrievalPlan {
    const text = query.query?.trim() ?? '';
    const safeTopK = clampTop(query.topK);

    if (!text) {
      /**
       * An empty query has no defensible retrieval strategy.
       * Fail loud here rather than letting a meaningless query
       * Silently hit the vector store / lexical index downstream
       */
      throw new BadRequestException('Query must not be empty');
    }

    if (!query.tenantId) {
      throw new BadRequestException('Unidentified Tenant');
    }

    let strategy: RetrievalPlan['strategy'] = 'hybrid';

    if (this.isLiteralIdentifier(text)) {
      strategy = 'lexical-only';
    }

    return {
      tenantId: query.tenantId,
      query: text,
      topK: safeTopK,
      strategy,
      filters: query.filters,
      options: {
        enableParentExpansion: true,
        enableRank: false,
        minimumVectorScore: 0.7,
      },
    };
  }

  /**
   * Matches only true literal identifiers — ticket IDs, UUIDs.
   * Anchored start-to-end, so a query merely *containing* an ID
   * ("JIRA-123 is blocking the release") still falls through to
   * hybrid instead of being misrouted to lexical-only.
   */
  private isLiteralIdentifier(input: string): boolean {
    return /^[A-Z]{2,}-\d+$/.test(input) || /^[a-f0-9-]{32,36}$/i.test(input);
  }
}
