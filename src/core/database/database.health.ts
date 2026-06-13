import { Inject, Injectable } from '@nestjs/common';
import { Pool } from 'pg';
// 1. Import your official injection token directly from your module
import { PG_CONNECTION } from './database.constants';
@Injectable()
export class DatabaseHealthService {
  constructor(
    // 2. FIXED: Swapped 'PG_POOL' for your actual registered token constant
    @Inject(PG_CONNECTION) private readonly pool: Pool,
  ) {}

  async ping(): Promise<boolean> {
    try {
      // 3. OPTIMIZED: Bypassed manual client tracking to prevent leak vulnerabilities
      await this.pool.query('SELECT 1');
      return true;
    } catch (error) {
      // Returns false safely if the database is unreachable or down
      return false;
    }
  }
}
