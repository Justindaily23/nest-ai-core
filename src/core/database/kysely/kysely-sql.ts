let sqlPromise: Promise<any> | null = null;

export async function getSql() {
  if (!sqlPromise) {
    sqlPromise = import('kysely').then((m) => m.sql);
  }
  return sqlPromise;
}
