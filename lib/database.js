import { neon } from '@neondatabase/serverless';
import { ApiError, migrate } from './elections.js';
let sql;
let ready;
export async function database() {
  if (!process.env.DATABASE_URL) throw new ApiError(503, 'A votação coletiva ainda está sendo configurada. O simulador educativo continua disponível.');
  sql ??= neon(process.env.DATABASE_URL);
  const query = (text, params) => sql.query(text, params);
  ready ??= migrate(query).catch(error => { ready = undefined; throw error; });
  await ready;
  return query;
}
