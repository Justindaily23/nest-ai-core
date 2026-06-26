/**
 * @file ingestion-errors.ts
 * @description DOMAIN RUNTIME BOUNDARY: Specialized Ingestion Pipeline Exceptions.
 *
 * DESIGN PRINCIPLE:
 * These domain-specific errors isolate layout-parsing failures from standard system exceptions.
 * By subclassing the native Error object, they allow downstream callers—such as NestJS HTTP
 * Global Filters or BullMQ background workers—to execute precise error-triage strategies
 * (e.g., immediate failure for invalid formats vs. backoff-retries for extraction stalls).
 */

/**
 * Thrown when the IngestionRouter evaluates a document envelope and finds
 * absolutely zero matching Codecs capable of handling the layout requirements.
 *
 * OPERATIONAL IMPACT: Hard validation failure. Downstream workers should NOT retry this job.
 */
export class UnsupportedIngestionFormatError extends Error {
  constructor(message = 'Unsupported ingestion format') {
    super(message);
    this.name = 'UnsupportedIngestionFormatError';
    // Captures the correct stack trace across modern runtime environments
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, UnsupportedIngestionFormatError);
    }
  }
}

/**
 * Thrown when an active Codec matches the input criteria but encounters a
 * catastrophic failure during the physical binary parsing loop (e.g., corrupted data arrays).
 *
 * OPERATIONAL IMPACT: Processing failure. Downstream workers may attempt an isolated retry.
 */
export class IngestionExtractionError extends Error {
  constructor(message = 'Failed to extract document') {
    super(message);
    this.name = 'IngestionExtractionError';
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, IngestionExtractionError);
    }
  }
}
