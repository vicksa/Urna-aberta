import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { createElectionService, migrate, digest } from '../lib/elections.js';
import { createHandler } from '../lib/http.js';
let db, service, query;
const password = 'test-only-organizer-password';
before(async () => {
  db = new PGlite();
  query = async (text, params) => (await db.query(text, params)).rows;
  await migrate(query); service = createElectionService(query);
});
after(async () => { await db.close(); });
async function setup(count = 4) {
  const election = await service.create('Consulta de teste');
  const codes = await service.codes(election.id, count);
  await service.transition(election.id, 'open');
  return { id: election.id, codes };
}
test('ciclo completo: códigos, abertura, quatro tipos de voto e encerramento', async () => {
  const { id, codes } = await setup();
  for (const [i, choice] of ['12','34','blank','null'].entries()) await service.vote({ id, code: codes[i], choice, requestId: randomUUID() });
  const open = await service.status(id);
  assert.equal(open.total, 4); assert.equal(open.results, undefined);
  await assert.rejects(service.codes(id, 1), { status: 409 });
  const closed = await service.transition(id, 'close');
  assert.deepEqual(closed.results, { '12': 1, '34': 1, blank: 1, null: 1 });
  await assert.rejects(service.transition(id, 'open'), { status: 409 });
});
test('mesmo código em envios simultâneos é consumido uma vez', async () => {
  const { id, codes } = await setup(1);
  const outcomes = await Promise.allSettled(Array.from({ length: 10 }, () => service.vote({ id, code: codes[0], choice: '12', requestId: randomUUID() })));
  assert.equal(outcomes.filter(o => o.status === 'fulfilled').length, 1);
  assert.equal((await service.status(id)).total, 1);
});
test('reenvio com o mesmo identificador não duplica e funciona após encerramento', async () => {
  const { id, codes } = await setup(1);
  const vote = { id, code: codes[0], choice: '34', requestId: randomUUID() };
  assert.deepEqual(await service.vote(vote), { ok: true, repeated: false });
  assert.deepEqual(await service.vote(vote), { ok: true, repeated: true });
  await service.transition(id, 'close');
  assert.deepEqual(await service.vote(vote), { ok: true, repeated: true });
  assert.equal((await service.status(id)).total, 1);
});
test('estado fechado, código de outra eleição e opções inválidas não contam', async () => {
  const a = await setup(2); const b = await setup(1);
  const vote = { id: a.id, code: b.codes[0], choice: '12', requestId: randomUUID() };
  await assert.rejects(service.vote(vote), { status: 409 });
  await assert.rejects(service.vote({ ...vote, code: a.codes[0], choice: '999' }), { status: 400 });
  await service.transition(a.id, 'close');
  await assert.rejects(service.vote({ ...vote, code: a.codes[0] }), { status: 409 });
  assert.equal((await service.status(a.id)).total, 0);
});
test('falha na contagem reverte consumo do código na mesma operação', async () => {
  const { id, codes } = await setup(1);
  const vote = { id, code: codes[0], choice: '12', requestId: randomUUID() };
  await query('UPDATE ua_elections SET c12 = 2147483647 WHERE id = $1', [id]);
  await assert.rejects(service.vote(vote));
  const [token] = await query('SELECT used FROM ua_tokens WHERE election_id = $1 AND token_hash = $2', [id, digest(codes[0].replaceAll('-', '').toLowerCase())]);
  assert.equal(token.used, false);
  await query('UPDATE ua_elections SET c12 = 0 WHERE id = $1', [id]);
  assert.equal((await service.vote(vote)).ok, true);
});
test('banco não tem coluna que armazena a escolha junto ao código', async () => {
  const rows = await query("SELECT column_name FROM information_schema.columns WHERE table_name = 'ua_tokens' ORDER BY ordinal_position", []);
  assert.deepEqual(rows.map(r => r.column_name), ['election_id', 'token_hash', 'used', 'request_id']);
});
test('API exige senha, bloqueia origem não permitida e limita tentativas', async () => {
  const handle = createHandler(async () => query, () => password);
  const request = (body, pass = '', origin = 'https://urna.example') => new Request('https://urna.example/api/election', { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: origin, Authorization: `Bearer ${pass}` }, body: JSON.stringify(body) });
  assert.equal((await handle(request({ action: 'create', title: 'Não pode' }))).status, 401);
  assert.equal((await handle(request({ action: 'list' }, password, 'https://other.example'))).status, 403);
  const created = await handle(request({ action: 'create', title: '<img onerror=alert(1)>' }, password));
  assert.equal(created.status, 201);
  assert.equal((await handle(request({ action: 'list' }, password))).status, 200);
  for (let i = 0; i < 10; i++) await handle(request({ action: 'list' }));
  assert.equal((await handle(request({ action: 'list' }))).status, 429);
  const response = await handle(new Request('https://urna.example/api/election', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: 'null' }));
  assert.equal(response.status, 400);
});
test('API retorna indisponível sem expor configuração privada', async () => {
  const handle = createHandler(async () => { throw new Error('postgres://secret'); });
  const result = await handle(new Request('https://urna.example/api/election?id=' + randomUUID()));
  assert.equal(result.status, 503); assert.equal((await result.text()).includes('postgres://'), false);
});
