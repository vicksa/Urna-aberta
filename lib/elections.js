import { createHash, randomBytes, randomUUID } from 'node:crypto';

export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export const digest = value => createHash('sha256').update(value).digest('hex');
export const validId = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
const choices = ['12', '34', 'blank', 'null'];
export const migrations = [
  `CREATE TABLE IF NOT EXISTS ua_elections (
    id UUID PRIMARY KEY, title TEXT NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
    state TEXT NOT NULL DEFAULT 'draft' CHECK (state IN ('draft','open','closed')),
    issued INTEGER NOT NULL DEFAULT 0 CHECK (issued BETWEEN 0 AND 5000),
    c12 INTEGER NOT NULL DEFAULT 0 CHECK (c12 >= 0), c34 INTEGER NOT NULL DEFAULT 0 CHECK (c34 >= 0),
    blank INTEGER NOT NULL DEFAULT 0 CHECK (blank >= 0), null_votes INTEGER NOT NULL DEFAULT 0 CHECK (null_votes >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now())`,
  `CREATE TABLE IF NOT EXISTS ua_tokens (
    election_id UUID NOT NULL REFERENCES ua_elections(id), token_hash TEXT NOT NULL,
    used BOOLEAN NOT NULL DEFAULT false, request_id UUID,
    PRIMARY KEY (election_id, token_hash))`,
  `CREATE TABLE IF NOT EXISTS ua_limits (key TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at TIMESTAMPTZ NOT NULL)`
];
export async function migrate(query) { for (const statement of migrations) await query(statement, []); }

function publicElection(row) {
  const total = row.c12 + row.c34 + row.blank + row.null_votes;
  return { id: row.id, title: row.title, state: row.state, total,
    ...(row.state === 'closed' ? { results: { '12': row.c12, '34': row.c34, blank: row.blank, null: row.null_votes } } : {}) };
}
export function createElectionService(query) {
  return {
    async status(id) {
      if (!validId(id)) throw new ApiError(400, 'O link da votação é inválido.');
      const [row] = await query('SELECT * FROM ua_elections WHERE id = $1', [id]);
      if (!row) throw new ApiError(404, 'Votação não encontrada. Confira o link com quem organizou.');
      return publicElection(row);
    },
    async list() {
      return (await query('SELECT * FROM ua_elections ORDER BY created_at DESC, id LIMIT 50', [])).map(row => ({ ...publicElection(row), issued: row.issued }));
    },
    async create(title) {
      if (typeof title !== 'string' || title.trim().length < 3 || title.trim().length > 100) throw new ApiError(400, 'Use um título entre 3 e 100 caracteres.');
      const id = randomUUID();
      const [row] = await query('INSERT INTO ua_elections (id, title) VALUES ($1, $2) RETURNING *', [id, title.trim()]);
      return publicElection(row);
    },
    async codes(id, count) {
      if (!validId(id) || !Number.isInteger(count) || count < 1 || count > 500) throw new ApiError(400, 'Gere entre 1 e 500 códigos por vez.');
      const codes = Array.from({ length: count }, () => randomBytes(16).toString('hex').toUpperCase().match(/.{1,4}/g).join('-'));
      const hashes = codes.map(code => digest(code.replaceAll('-', '').toLowerCase()));
      const rows = await query(`WITH reserved AS (
        UPDATE ua_elections SET issued = issued + $2 WHERE id = $1 AND state = 'draft' AND issued + $2 <= 5000 RETURNING id
      ) INSERT INTO ua_tokens (election_id, token_hash)
        SELECT reserved.id, item FROM reserved CROSS JOIN jsonb_array_elements_text($3::jsonb) AS item RETURNING token_hash`, [id, count, JSON.stringify(hashes)]);
      if (rows.length !== count) throw new ApiError(409, 'Gere códigos antes de abrir a votação. O limite é de 5.000 por consulta.');
      return codes;
    },
    async transition(id, action) {
      if (!validId(id) || !['open','close'].includes(action)) throw new ApiError(400, 'Ação inválida.');
      const from = action === 'open' ? 'draft' : 'open';
      const to = action === 'open' ? 'open' : 'closed';
      const [row] = await query('UPDATE ua_elections SET state = $2 WHERE id = $1 AND state = $3 AND issued > 0 RETURNING *', [id, to, from]);
      if (!row) throw new ApiError(409, 'A mudança não foi feita. Gere códigos antes de abrir; uma votação encerrada não pode ser reaberta. Atualize o painel.');
      return publicElection(row);
    },
    async vote({ id, code, choice, requestId }) {
      const normalized = typeof code === 'string' ? code.replaceAll('-', '').replaceAll(' ', '').toLowerCase() : '';
      if (!validId(id) || !validId(requestId) || !/^[a-f0-9]{32}$/.test(normalized) || !choices.includes(choice)) throw new ApiError(400, 'Confira o código de participação e a opção escolhida.');
      // One PostgreSQL statement: consuming the code and adding to an aggregate are atomic.
      // We never store the choice with the code, participant identity, IP or timestamp.
      const [row] = await query(`WITH locked AS (
          SELECT id, state FROM ua_elections WHERE id = $1 FOR UPDATE
        ), redeemed AS (
          UPDATE ua_tokens SET used = true, request_id = $3
          WHERE election_id = $1 AND token_hash = $2 AND used = false
            AND EXISTS (SELECT 1 FROM locked WHERE state = 'open') RETURNING election_id
        ), counted AS (
          UPDATE ua_elections SET c12 = c12 + CASE WHEN $4 = '12' THEN 1 ELSE 0 END,
            c34 = c34 + CASE WHEN $4 = '34' THEN 1 ELSE 0 END,
            blank = blank + CASE WHEN $4 = 'blank' THEN 1 ELSE 0 END,
            null_votes = null_votes + CASE WHEN $4 = 'null' THEN 1 ELSE 0 END
          WHERE id IN (SELECT election_id FROM redeemed) RETURNING id
        ) SELECT EXISTS(SELECT 1 FROM counted) AS accepted,
          EXISTS(SELECT 1 FROM ua_tokens WHERE election_id = $1 AND token_hash = $2 AND used = true AND request_id = $3) AS replay,
          (SELECT state FROM locked) AS state`, [id, digest(normalized), requestId, choice]);
      if (row.accepted || row.replay) return { ok: true, repeated: !row.accepted };
      if (row.state !== 'open') throw new ApiError(409, 'Esta votação não está aberta.');
      throw new ApiError(409, 'Código inválido ou já utilizado. Se você acabou de confirmar, tente novamente com a mesma escolha para verificar o envio.');
    }
  };
}
