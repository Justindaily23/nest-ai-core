/**
 * @file database.constants.ts
 * Isolated configuration tokens preventing circular module mapping leaks.
 */
export const PG_CONNECTION = Symbol('PG_CONNECTION');
export const KYSELY_CONNECTION = Symbol('KYSELY_CONNECTION');
