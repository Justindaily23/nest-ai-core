export type LogSystemType = 'http' | 'redis' | 'database' | 'billing';

// GlobalHttpExceptionFilter
export interface HttpExceptionFilterLogPayload {
  system: 'http';
  endpoint: string;
  statusCode: number;
  err: unknown;
}

//  SystemLoggingInterceptor
export interface HttpInterceptorLogPayload {
  system: 'http';
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
