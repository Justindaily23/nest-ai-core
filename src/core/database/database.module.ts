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

export const PG_CONNECTION = 'PG_CONNECTION';

const PostgresConnectionProvider: Provider = {
  provide: PG_CONNECTION,
  useFactory: (configService: AppConfigService, logger: PinoLogger) => {
    logger.setContext('DatabaseModule');
    const databaseUrl = configService.databaseUrl;
    return createDatabasePool(databaseUrl, logger);
  },
  inject: [AppConfigService, PinoLogger],
};

@Global()
@Module({
  providers: [PostgresConnectionProvider],
  exports: [PG_CONNECTION],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(
    @Inject(PG_CONNECTION) private readonly pool: Pool,
    private readonly logger: PinoLogger,
  ) {
    // 1. Set the logging context safely inside the valid class constructor
    this.logger.setContext('DatabaseModule');
  }

  // 2. This single method handles clean teardown when the application stops
  async onModuleDestroy() {
    await this.pool.end();
    this.logger.info('Database pool has been gracefully shut down');
  }
}
