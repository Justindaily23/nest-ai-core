export type ActorType = 'system' | 'user' | 'service'; // cron/worker(system), human(user), api/service(service)
export type PlanTier = 'free' | 'pro' | 'enterprise';

/**
 * Strongly typed system capabilities to prevent string typos in business logic.
 */
export type SystemCapability =
  | 'models:advanced:access'
  | 'features:beta:access'
  | 'rag:custom-embedding:write'
  | 'admin:telemetry:read';

/**
 * Defines the strict, immutable metadata payload attached to every execution lifecycle.
 * Acts as the internal "passport" for resource authorization, safety boundaries, and telemetry.
 */
export interface AppRequestContext {
  readonly requestId: string; // Unique identifier for the request, useful for tracing and logging.
  readonly timestamp: number; // Unix timestamp of when the execution context was created, useful for timeout and expiration logic.

  actor: {
    type: ActorType;
    id?: string;
  };

  tenant?: {
    id: string;
  };

  plan?: {
    tier: PlanTier;
    hardLimits: {
      requestPerMinute: number;
      tokenPerMonth: number;
      maxTokenPerRequest: number;
    };
  };

  capabilities: SystemCapability[]; // e.g., ['canUseAdvancedModel', 'canAccessBetaFeatures']

  source: {
    readonly ip?: string;
    readonly userAgent?: string;
  };
}
