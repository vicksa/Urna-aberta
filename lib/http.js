import { createHash, timingSafeEqual, createHmac } from 'node:crypto';
import { ApiError, createElectionService } from './elections.js';

export function createHandler(getDatabase, getPassword = () => process.env.ADMIN_PASSWORD) {
  return async function handle(request) {
    const url = new URL(request.url);
    const origin = request.headers.get('origin');
    const allowed = !origin || origin === url.origin || origin === 'https://vicksa.github.io';
    const headers = { 'Cache-Control': 'no-store', 'Content-Type': 'application/json; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Origin' };
    if (allowed && origin) headers['Access-Control-Allow-Origin'] = origin;
    const json = (data, status = 200) => new Response(JSON.stringify(data), { status, headers });
    if (!allowed) return json({ error: 'Origem não autorizada.' }, 403);
    if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: { ...headers, 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type, Authorization' } });
    try {
      if (request.method === 'GET') {
        const service = createElectionService(await getDatabase());
        return json(await service.status(url.searchParams.get('id')));
      }
      if (request.method !== 'POST') return json({ error: 'Método não permitido.' }, 405);
      if (!(request.headers.get('content-type') || '').startsWith('application/json')) throw new ApiError(415, 'Envie JSON.');
      const raw = await request.text();
      if (Buffer.byteLength(raw) > 8192) throw new ApiError(413, 'Solicitação muito grande.');
      let body;
      try { body = JSON.parse(raw); } catch { throw new ApiError(400, 'Solicitação inválida.'); }
      if (!body || typeof body !== 'object' || Array.isArray(body)) throw new ApiError(400, 'Solicitação inválida.');
      const query = await getDatabase();
      const service = createElectionService(query);
      if (body.action === 'vote') return json(await service.vote(body));
      // All administrative operations require a server-only password.
      const password = getPassword();
      if (!password || password.length < 16) throw new ApiError(503, 'O painel aguarda a configuração da senha do organizador.');
      const supplied = (request.headers.get('authorization') || '').replace(/^Bearer /, '');
      const hash = value => createHash('sha256').update(value).digest();
      if (!timingSafeEqual(hash(supplied), hash(password))) {
        const ip = request.headers.get('x-vercel-forwarded-for') || 'local';
        const window = Math.floor(Date.now() / 600000);
        const key = createHmac('sha256', password).update(`${ip}:${window}`).digest('hex');
        const [limit] = await query(`INSERT INTO ua_limits (key, count, expires_at) VALUES ($1, 1, now() + interval '10 minutes')
          ON CONFLICT (key) DO UPDATE SET count = ua_limits.count + 1 RETURNING count`, [key]);
        await query('DELETE FROM ua_limits WHERE expires_at < now()', []);
        throw new ApiError(limit.count > 10 ? 429 : 401, limit.count > 10 ? 'Muitas tentativas. Aguarde dez minutos.' : 'Senha do organizador inválida.');
      }
      if (body.action === 'list') return json({ elections: await service.list() });
      if (body.action === 'create') return json(await service.create(body.title), 201);
      if (body.action === 'codes') return json({ codes: await service.codes(body.id, body.count) }, 201);
      if (body.action === 'open' || body.action === 'close') return json(await service.transition(body.id, body.action));
      throw new ApiError(400, 'Ação desconhecida.');
    } catch (error) {
      if (error instanceof ApiError) return json({ error: error.message }, error.status);
      // Avoid logging submitted codes, choices, passwords, SQL parameters or connection strings.
      console.error('collective_request_failed', { name: error.name, code: error.code || 'unknown' });
      return json({ error: 'Não foi possível concluir a operação. Tente novamente; votos confirmados não serão duplicados.' }, 503);
    }
  };
}
