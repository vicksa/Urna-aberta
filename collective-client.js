'use strict';
const configured = window.URNA_API_ORIGIN || '';
export const apiOrigin = configured.replace(/\/$/, '');
export const endpoint = `${apiOrigin}/api/election`;
export async function callApi(body, password) {
  let response;
  try {
    response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...(password ? { Authorization: `Bearer ${password}` } : {}) }, body: JSON.stringify(body), signal: AbortSignal.timeout(20000) });
  } catch { throw new Error('Sem conexão com a votação. Tente novamente sem mudar sua escolha.'); }
  let data;
  try { data = await response.json(); } catch { throw new Error('A votação coletiva ainda não está disponível neste endereço. Use o link enviado pelo organizador.'); }
  if (!response.ok) { const error = new Error(data.error || 'Não foi possível concluir. Tente novamente.'); error.status = response.status; throw error; }
  return data;
}
export const stateNames = { draft: 'Em preparação', open: 'Aberta para votar', closed: 'Encerrada' };
export const candidateNames = { '12': 'Ana do Jardim', '34': 'Bruno do Sol', blank: 'Brancos', null: 'Nulos' };
export function showResults(container, election) {
  container.replaceChildren();
  if (!election.results) { const p = document.createElement('p'); p.textContent = 'Os totais por opção serão publicados após o encerramento.'; container.append(p); return; }
  const title = document.createElement('h3'); title.textContent = 'Resultado da consulta educativa'; container.append(title);
  const valid = election.results['12'] + election.results['34'];
  for (const [choice, name] of Object.entries(candidateNames)) {
    const count = election.results[choice];
    const row = document.createElement('div'); row.className = 'result-row';
    const text = document.createElement('span'); text.textContent = name;
    const number = document.createElement('strong'); number.textContent = String(count);
    row.append(text, number); container.append(row);
  }
  const total = document.createElement('p'); total.textContent = `Total confirmado: ${election.total} • Votos válidos: ${valid}. Brancos e nulos não são atribuídos aos candidatos.`; container.append(total);
}
