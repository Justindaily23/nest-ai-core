import { HttpStatus } from '@nestjs/common';

export type ErrorSystem = 'redis' | 'database' | 'llm' | 'auth' | 'system';

export class OperationalException extends Error {
  public readonly timestamp: string;

  constructor(
    public readonly system: ErrorSystem, // 'redis', 'database', etc.
    public readonly code: string, // Machine-readable code (e.g., 'REDIS_GET_FAILED')
    message: string, // Clean, human-readable error description
    public readonly statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR, // 500, 400, etc.
    public readonly originalError: unknown = null, // The raw underlying error object/stack trace
  ) {
    super(message);
    this.name = 'OperationalException';
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, OperationalException);
    }
  }
}
