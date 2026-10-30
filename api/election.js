import { database } from '../lib/database.js';
import { createHandler } from '../lib/http.js';
const handle = createHandler(database);
export const GET = handle;
export const POST = handle;
export const OPTIONS = handle;
