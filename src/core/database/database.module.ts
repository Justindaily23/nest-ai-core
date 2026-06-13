import {
  Module,
  Provider,
  Inject,
  Global,
  OnModuleDestroy,
} from '@nestjs/common';
import { AppConfigService } from '@/config/config.service';
import { createDatabasePool } from './database.connection';
import { PinoLogger } from 'nestjs-pino';
import { Pool } from 'pg';
import { Database } from './kysely/database.types';
import { Kysely, PostgresDialect } from 'kysely';
import { DatabaseService } from './database.service';
import { KYSELY_CONNECTION, PG_CONNECTION } from './database.constants';

const PostgresConnectionProvider: Provider = {
  provide: PG_CONNECTION,
  useFactory: (configService: AppConfigService, logger: PinoLogger) => {
    logger.setContext('DatabaseModule');
    const databaseUrl = configService.databaseUrl;
    return createDatabasePool(databaseUrl, logger);
  },
  inject: [AppConfigService, PinoLogger],
};

const KyselyProvider: Provider = {
  provide: KYSELY_CONNECTION,
  useFactory: (pool: Pool, logger: PinoLogger) => {
    return new Kysely<Database>({
      dialect: new PostgresDialect({
        pool,
      }),
      // Hook into Kysely's built-in global telemetry pipeline
      log: (event) => {
        if (event.level === 'query') {
          logger.info(
            {
              context: 'KyselyEngine',
              sql: event.query.sql,
              parameters: event.query.parameters,
              durationMs: event.queryDurationMillis,
            },
            `Executed SQL Query`,
          );
        } else if (event.level === 'error') {
          logger.error(
            {
              context: 'KyselyEngine',
              error: event.error,
              sql: event.query.sql,
              durationMs: event.queryDurationMillis,
            },
            `SQL Execution Failed`,
          );
        }
      },
    });
  },
  inject: [PG_CONNECTION, PinoLogger],
};

@Global()
@Module({
  providers: [PostgresConnectionProvider, KyselyProvider, DatabaseService],
  exports: [PG_CONNECTION, KYSELY_CONNECTION, DatabaseService],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(
    @Inject(PG_CONNECTION) private readonly pool: Pool,
    @Inject(KYSELY_CONNECTION) private readonly kysely: Kysely<Database>,
    private readonly logger: PinoLogger,
  ) {
    // 1. Set the logging context safely inside the valid class constructor
    this.logger.setContext('DatabaseModule');
  }

  // 2. This single method handles clean teardown when the application stops
  async onModuleDestroy() {
    await this.kysely.destroy();
    this.logger.info(
      'Kysely engine and database connection pool have been gracefully shut down',
    );
  }
}
