export type DatabaseErrorSystem = 'database' | 'cache';

export class DatabaseStorageException extends Error {
  public readonly timestamp: string;

  constructor(
    public readonly system: DatabaseErrorSystem, // 'database' or 'cache'
    public readonly code: string, // Machine-readable code (e.g., 'EMBEDDING_UPSERT_FAILED')
    message: string, // Clean, human-readable error description
    public readonly originalError: unknown = null, // The raw underlying error object/stack trace
  ) {
    super(message);
    this.name = 'DatabaseStorageException';
    this.timestamp = new Date().toISOString();

    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, DatabaseStorageException);
    }
  }
}
