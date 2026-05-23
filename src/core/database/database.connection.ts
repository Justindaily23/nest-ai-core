import { Pool } from 'pg';
import { PinoLogger } from 'nestjs-pino';

/**Factory function to safely instantiate the pool  after environment variables are loaded */
export const createDatabasePool = (
  databaseUrl: string,
  logger: PinoLogger,
): Pool => {
  // Instatiate the pool with connection parameters and telemetry
  const pool = new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  });

  // Event listeners (Telemetry)
  pool.on('connect', () => {
    logger.info('Database connection established');
  });

  pool.on('error', (err) => {
    logger.error('Database connection error', err);
  });

  // Return the pool instance for use in the DatabaseService
  return pool;
};
