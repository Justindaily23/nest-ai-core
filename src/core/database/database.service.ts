// Path: src/core/database/database.service.ts

import { Inject, Injectable } from '@nestjs/common';
import { Kysely } from 'kysely';
import { Database } from './kysely/database.types';
import { KYSELY_CONNECTION } from './database.module';

@Injectable()
export class DatabaseService {
  constructor(
    @Inject(KYSELY_CONNECTION) public readonly client: Kysely<Database>,
  ) {}
}
