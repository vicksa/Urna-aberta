import { endpoint, callApi, stateNames, candidateNames, showResults } from './collective-client.js';
const $ = id => document.getElementById(id);
const id = new URL(location.href).searchParams.get('id');
let election, pending, submitting = false, succeeded = false;
function message(text, error = false) { $('message').textContent = text; $('message').classList.toggle('error', error); }
async function refresh() {
  $('refresh').disabled = true;
  try {
    if (!id) throw new Error('Abra o link completo da votação enviado pelo organizador. Para criar uma consulta, use o painel do organizador abaixo.');
    const response = await fetch(`${endpoint}?id=${encodeURIComponent(id)}`, { cache: 'no-store', signal: AbortSignal.timeout(20000) });
    let data; try { data = await response.json(); } catch { throw new Error('A votação coletiva ainda não está disponível neste endereço. Use o link enviado pelo organizador.'); }
    if (!response.ok) throw new Error(data.error || 'Não foi possível carregar.');
    election = data;
    $('title').textContent = data.title; $('election').hidden = false;
    $('state').textContent = stateNames[data.state]; $('turnout').textContent = `${data.total} voto(s) confirmado(s)`;
    $('vote-form').hidden = data.state !== 'open' || succeeded || Boolean(pending);
    if (data.state !== 'open' && !pending) $('confirmation').hidden = true;
    $('results').hidden = data.state === 'open'; showResults($('results'), data);
    if (!succeeded) message(data.state === 'open' ? 'Votação aberta. Use seu código para participar.' : data.state === 'draft' ? 'O organizador ainda está preparando esta votação.' : 'Votação encerrada. Confira o resultado abaixo.');
  } catch (error) { message(error.name === 'TimeoutError' || error instanceof TypeError ? 'Não foi possível conectar. Confira sua internet e tente atualizar.' : error.message, true); }
  finally { $('refresh').disabled = false; }
}
$('vote-form').onsubmit = event => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const code = form.get('code').replaceAll('-', '').replaceAll(' ', '');
  if (!/^[a-f0-9]{32}$/i.test(code)) { message('Confira o código: ele contém 32 letras e números, separados em grupos.', true); $('code').focus(); return; }
  pending = { action: 'vote', id, code: form.get('code'), choice: form.get('choice'), requestId: crypto.randomUUID() };
  $('selected-choice').textContent = `Sua escolha: ${candidateNames[pending.choice]}.`;
  $('vote-form').hidden = true; $('confirmation').hidden = false; $('correct-vote').hidden = false; $('confirm-vote').textContent = 'Confirmar voto'; message('Confira sua escolha e confirme.'); $('confirm-title').focus();
};
$('correct-vote').onclick = () => { if (submitting) return; pending = undefined; $('confirmation').hidden = true; $('vote-form').hidden = election.state !== 'open'; $('code').focus(); message('Você pode corrigir sua escolha.'); };
$('confirm-vote').onclick = async () => {
  if (submitting || !pending) return;
  submitting = true; $('confirm-vote').disabled = true; $('correct-vote').disabled = true; $('confirm-vote').textContent = 'Enviando…';
  try {
    await callApi(pending); succeeded = true; pending = undefined;
    $('confirmation').hidden = true; $('success').hidden = false; $('code').value = ''; $('vote-form').reset();
    message('Voto confirmado na contagem coletiva.'); await refresh();
  } catch (error) {
    // Keep requestId and choice unchanged so an uncertain network response can be retried safely.
    message(`${error.message} Em caso de falha de conexão, use “Tentar confirmar novamente”.`, true);
    $('correct-vote').hidden = !(error.status >= 400 && error.status < 500);
  } finally { submitting = false; $('confirm-vote').disabled = false; $('correct-vote').disabled = false; $('confirm-vote').textContent = 'Tentar confirmar novamente'; }
};
$('refresh').onclick = refresh;
$('share').onclick = async event => { event.preventDefault(); try { await navigator.clipboard.writeText(location.href); message('Link da votação copiado. Compartilhe o link; cada pessoa precisa do próprio código.'); } catch { message('Copie o endereço desta página para compartilhar.'); } };
refresh();
