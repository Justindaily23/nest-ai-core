export type ActorType = 'system' | 'user' | 'service'; // cron/worker(system), human(user), api/service(service)
export type PlanTier = 'free' | 'pro' | 'enterprise';

/**
 * Defines the strict, immutable metadata payload attached to every execution lifecycle.
 * Acts as the internal "passport" for resource authorization, safety boundaries, and telemetry.
 */
export interface ExecutionContext {
  requestId: string; // Unique identifier for the request, useful for tracing and logging.
  timestamp: number; // Unix timestamp of when the execution context was created, useful for timeout and expiration logic.

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

  capabilities: string[]; // e.g., ['canUseAdvancedModel', 'canAccessBetaFeatures']

  source: {
    ip?: string;
    userAgent?: string;
  };
}
