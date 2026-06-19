import { Injectable } from '@nestjs/common';
import { HybridRetrievalService } from './hybrid-retrieval.service';
import { VectorRetrieverAdapter } from '../adapters/vector-retriever.adapter';
import { LexicalRetrievalService } from './lexical-retrieval.service';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RetrievalPlan } from '../../shared/types/retrieval-plan.type';
import { RetrievedContext } from '../../shared/types/retrieved-context.type';

@Injectable()
export class RetrievalExecutionService {
  constructor(
    private readonly hybridService: HybridRetrievalService,
    private readonly vectorAdapter: VectorRetrieverAdapter,
    private readonly lexicalService: LexicalRetrievalService,
    @InjectPinoLogger(RetrievalExecutionService.name)
    private readonly logger: PinoLogger,
  ) {}

  async execute(plan: RetrievalPlan): Promise<RetrievedContext[]> {
    this.logger.debug(
      { tenantId: plan.tenantId, strategy: plan.strategy, topK: plan.topK },
      'Executing retrieval plan.....',
    );

    const startTime = Date.now();

    const results = await this.dispatch(plan);

    this.logger.info(
      {
        tenantId: plan.tenantId,
        strategy: plan.strategy,
        durationMs: Date.now() - startTime,
        count: results.length,
      },
      'Retrieval plan executed',
    );
    return results;
  }

  private async dispatch(plan: RetrievalPlan): Promise<RetrievedContext[]> {
    switch (plan.strategy) {
      case 'lexical-only':
        return this.lexicalService.retrieve(plan);
      case 'vector-only':
        return this.vectorAdapter.retrieve(plan);
      case 'hybrid':
      default:
        return this.hybridService.retrieve(plan);
    }
  }
}
