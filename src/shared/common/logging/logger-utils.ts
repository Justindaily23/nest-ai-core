/**
 * Safely normalizes any exception into a clean, structured object for Pino
 */
export function serializeException(exception: unknown) {
  if (exception instanceof Error) {
    return {
      name: exception.name,
      message: exception.message,
      stack: exception.stack,
    };
  }
  return exception;
}
