import { Injectable } from '@nestjs/common';
import { QueryService } from '../query/query.service';
import { RetrievalExecutionService } from '../retrieval/services/retrieval-execution.service';
import { ParentExpansionService } from '../retrieval/services/parent-expansion.service';
import { ContextAssemblyService } from '../context-assembly/service/context-assembly.service';
import { CitationBoundaryService } from '../citation-boundaries/services/citation-boundary.service';
import { PromptFormattingService } from '../prompt-formatting/services/prompt-formatting.service';
import { CitationValidationService } from '../citation/services/citation-validation.service';
import { InjectPinoLogger, PinoLogger } from 'nestjs-pino';
import { RetrievalQuery } from '../shared/types/retrieval-query.type';
import { AppConfigService } from '@/config/config.service';
import { AIService } from '@/modules/ai/ai.service';
import { RagResponse } from '../shared/types/rag-response.type';
import { AIProviderName } from '@/modules/ai/ai.types';

@Injectable()
export class RagOrchestratorService {
  constructor(
    private readonly queryService: QueryService,
    private readonly executionService: RetrievalExecutionService,
    private readonly parentExpansionService: ParentExpansionService,
    private readonly contextAssemblyService: ContextAssemblyService,
    private readonly citationBoundaryService: CitationBoundaryService,
    private readonly promptFormattingService: PromptFormattingService,
    private readonly citationValidationService: CitationValidationService,
    private readonly appConfig: AppConfigService,

    private readonly llm: AIService,
    @InjectPinoLogger(RagOrchestratorService.name)
    private readonly logger: PinoLogger,
  ) {}

  async query(input: RetrievalQuery): Promise<RagResponse> {
    // 1. Plan
    const plan = this.queryService.buildPlan(input);

    // 2. Retrieve — flat RetrievedContext[]
    const contexts = await this.executionService.execute(plan);

    // 3. Expand parents — groups children under their parent chunks,
    //    fetches parent content from DB, scores parents by best child score
    const parents = await this.parentExpansionService.expand(
      contexts,
      plan.tenantId,
    );

    // 4. Assemble context — token budget enforced here
    const assembled = this.contextAssemblyService.assemble({
      parents,
      tokenBudget: 6000,
    });

    // 5. Build citation boundary — produces citationMap + prompt-safe units
    const { units, citationMap } =
      this.citationBoundaryService.build(assembled);

    // 6. Format prompt
    const prompt = this.promptFormattingService.format({
      systemPrompt: '...',
      userQuery: input.query,
      citationContext: units,
    });

    // 7. Generate
    const rawAnswer = await this.llm.generate({
      provider: this.appConfig.llmProvider as AIProviderName,
      model: this.appConfig.llmModel, // need to add this getter
      messages: prompt.messages,
      options: {
        temperature: 0.2, // low temperature for factual RAG answers
        maxTokens: 1000,
      },
    });

    const rawAnswerText = rawAnswer.content; // AIChatResponse.content is the string

    // 8. Validate citations — trust boundary, nothing unchecked escapes
    const result = this.citationValidationService.validate({
      rawAnswer: rawAnswerText,
      citationMap,
    });

    this.logger.info(
      {
        tenantId: plan.tenantId,
        hallucinated: result.hallucinated.length,
        validated: result.validatedCitations.length,
        unused: result.unusedCitations.length,
        latencyMs: rawAnswer.metadata.latencyMs,
        inputTokens: rawAnswer.metadata.usage.inputTokens,
        outputTokens: rawAnswer.metadata.usage.outputTokens,
        costUsd: rawAnswer.metadata.usage.costUsd,
      },
      'RAG query completed',
    );

    return {
      answer: result.answer,
      citations: result.validatedCitations,
      meta: {
        hallucinatedCitations: result.hallucinated,
        unusedCitations: result.unusedCitations,
      },
    };
  }
}
