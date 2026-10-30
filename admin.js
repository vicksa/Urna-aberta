import { apiOrigin, callApi, stateNames, showResults } from './collective-client.js';
const $ = id => document.getElementById(id);
let password = '', codes = [], codesTitle = '', busy = false;
function message(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
function button(label, handler, className = 'button secondary') { const b = document.createElement('button'); b.type = 'button'; b.className = className; b.textContent = label; b.onclick = handler; return b; }
async function run(work) {
  if (busy) return;
  busy = true; document.querySelectorAll('button').forEach(b => b.disabled = true);
  try { await work(); } catch (error) { message(error.message, true); }
  finally { busy = false; document.querySelectorAll('button').forEach(b => b.disabled = false); }
}
function votingLink(id) { return new URL(`votacao.html?id=${encodeURIComponent(id)}`, apiOrigin ? `${apiOrigin}/` : location.href).href; }
async function load() {
  const data = await callApi({ action: 'list' }, password);
  $('login-form').hidden = true; $('dashboard').hidden = false;
  $('elections').replaceChildren();
  if (!data.elections.length) { const p = document.createElement('p'); p.textContent = 'Nenhuma votação criada. Comece pelo formulário acima.'; $('elections').append(p); }
  for (const election of data.elections) {
    const article = document.createElement('article'); article.className = 'admin-election';
    const title = document.createElement('h3'); title.textContent = election.title;
    const info = document.createElement('p'); info.textContent = `${stateNames[election.state]} • ${election.issued} código(s) emitido(s) • ${election.total} voto(s) confirmado(s)`;
    const link = document.createElement('a'); link.href = votingLink(election.id); link.textContent = 'Abrir página da votação ↗'; link.className = 'text-link'; link.target = '_blank'; link.rel = 'noopener';
    const row = document.createElement('div'); row.className = 'button-row';
    row.append(button('Copiar link', () => run(async () => { await navigator.clipboard.writeText(votingLink(election.id)); message('Link copiado. Entregue os códigos individualmente, fora do link.'); })));
    if (election.state === 'draft') {
      const label = document.createElement('label'); label.htmlFor = `count-${election.id}`; label.textContent = 'Quantidade de códigos (1 a 500)';
      const input = document.createElement('input'); input.id = label.htmlFor; input.type = 'number'; input.min = '1'; input.max = '500'; input.value = '30'; input.required = true;
      article.append(title, info, link, label, input);
      row.append(button('Gerar códigos', () => run(async () => {
        if (codes.length) throw new Error('Guarde e confirme os códigos já exibidos antes de gerar outros.');
        const count = Number(input.value); if (!Number.isInteger(count) || count < 1 || count > 500) throw new Error('Escolha uma quantidade inteira entre 1 e 500.');
        const data = await callApi({ action: 'codes', id: election.id, count }, password);
        codes = data.codes; codesTitle = election.title; $('codes').textContent = codes.join('\n'); $('unsaved-codes').hidden = false;
        message('Códigos gerados. Baixe a lista agora; ela não poderá ser recuperada do servidor.'); await load(); $('unsaved-codes').scrollIntoView({ behavior: 'smooth' });
      })));
      row.append(button('Abrir votação', () => run(async () => {
        if (codes.length) throw new Error('Guarde e confirme os códigos exibidos antes de abrir a votação.');
        if (!confirm('Abrir a votação? Depois, não será possível emitir mais códigos.')) return;
        await callApi({ action: 'open', id: election.id }, password); message('Votação aberta. Compartilhe o link com os participantes.'); await load();
      }), 'button primary'));
    } else {
      article.append(title, info, link);
      if (election.state === 'open') row.append(button('Encerrar votação', () => run(async () => {
        if (!confirm('Encerrar e publicar os resultados? Essa votação não poderá ser reaberta.')) return;
        await callApi({ action: 'close', id: election.id }, password); message('Votação encerrada. O resultado já está público no link da consulta.'); await load();
      }), 'button primary'));
      if (election.state === 'closed') { const results = document.createElement('div'); showResults(results, election); article.append(results); }
    }
    article.append(row); $('elections').append(article);
  }
}
$('login-form').onsubmit = event => { event.preventDefault(); password = $('password').value; $('password').value = ''; run(async () => { await load(); message('Painel aberto. Crie uma votação ou gerencie as existentes.'); }); };
$('create-form').onsubmit = event => { event.preventDefault(); run(async () => { await callApi({ action: 'create', title: $('election-title').value }, password); $('create-form').reset(); await load(); message('Votação criada. Gere os códigos antes de abrir.'); }); };
$('reload').onclick = () => run(async () => { await load(); message('Painel atualizado.'); });
$('logout').onclick = () => { if (codes.length && !confirm('Você já guardou os códigos? A lista será apagada da tela.')) return; password = ''; codes = []; $('codes').textContent = ''; $('unsaved-codes').hidden = true; $('elections').replaceChildren(); $('dashboard').hidden = true; $('login-form').hidden = false; message('Você saiu do painel.'); };
$('download-codes').onclick = () => {
  const data = new Blob([`Urna Aberta — ${codesTitle}\nEntregue um código por participante. Não publique esta lista.\n\n${codes.join('\n')}\n`], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(data); const a = document.createElement('a'); a.href = url; a.download = 'codigos-urna-aberta.txt'; a.click(); URL.revokeObjectURL(url);
};
$('saved-codes').onclick = () => { if (!confirm('Você guardou a lista em um local seguro? Os códigos completos não poderão ser recuperados.')) return; codes = []; $('codes').textContent = ''; $('unsaved-codes').hidden = true; message('Distribua um código por pessoa. Agora você pode abrir a votação.'); };
window.addEventListener('beforeunload', event => { if (codes.length) { event.preventDefault(); event.returnValue = ''; } });
