export type LogSystemType = 'http' | 'redis' | 'database' | 'billing';

// GlobalHttpExceptionFilter
export interface HttpExceptionFilterLogPayload {
  system: 'http' | 'redis' | 'database' | 'system' | 'llm';
  endpoint: string;
  statusCode: number;
  err: unknown;
}

//  SystemLoggingInterceptor
export interface HttpInterceptorLogPayload {
  system: 'http' | 'redis' | 'database' | 'system' | 'llm';
  executionContext: string;
  http: {
    method: string;
    url: string;
  };
  metrics: {
    executionDuration?: number; // Used in tap()
    durationMs?: number; // Used in catchError()
  };
  err?: unknown;
}

//  Matches your RedisService
export interface RedisServiceLogPayload {
  system: 'redis';
  domain: string;
  key: string;
  err: unknown;
}

// r union type representing every valid log shape
export type AppLogPayload =
  | HttpExceptionFilterLogPayload
  | HttpInterceptorLogPayload
  | RedisServiceLogPayload;
