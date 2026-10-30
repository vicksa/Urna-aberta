'use strict';
const candidates={'12':'Ana do Jardim','34':'Bruno do Sol'};
let digits='',blank=false,confirmed=false,closed=false;
let tally={'12':0,'34':0,blank:0,null:0};
const $=id=>document.getElementById(id);
const controls=()=>document.querySelectorAll('.keypad button');
function render(){
 const content=$('vote-content');
 if(confirmed){content.innerHTML='<div class="end">FIM</div>';return;}
 const boxes=`<div class="digit-boxes"><span>${digits[0]||''}</span><span>${digits[1]||''}</span></div>`;
 const selection=blank?'VOTO EM BRANCO':digits.length===2?(candidates[digits]||'VOTO NULO'):'Digite o número';
 content.innerHTML=`<small>SEU VOTO PARA</small><h3>Prefeito fictício</h3>${blank?'':boxes}<p><strong>${selection}</strong></p>${candidates[digits]&&!blank?'<p>Candidatura fictícia</p>':''}`;
}
function action(type){
 if(closed||confirmed)return;
 if(type==='correct'){digits='';blank=false;$('status').textContent='Escolha corrigida. Digite novamente.';}
 if(type==='blank'){if(digits){$('status').textContent='Para votar em branco, pressione CORRIGE primeiro.';return;}blank=true;$('status').textContent='Voto em branco selecionado. Confirme ou corrija.';}
 if(type==='confirm'){
  if(!blank&&digits.length!==2){$('status').textContent='Digite os dois números ou selecione BRANCO antes de confirmar.';return;}
  const key=blank?'blank':candidates[digits]?digits:'null';tally[key]++;confirmed=true;
  $('status').textContent='Voto simulado registrado. Continue com outro eleitor ou encerre a votação.';
  controls().forEach(b=>b.disabled=true);$('next').hidden=false;
 }
 render();
}
function digit(n){if(closed||confirmed||blank||digits.length>=2)return;digits+=n;$('status').textContent=digits.length===2?'Confira a escolha. CONFIRMA registra o voto; CORRIGE permite recomeçar.':'Digite o segundo número.';render();}
for(const n of ['1','2','3','4','5','6','7','8','9','0']){const b=document.createElement('button');b.textContent=n;b.setAttribute('aria-label',`Número ${n}`);b.addEventListener('click',()=>digit(n));$('numbers').append(b);}
document.querySelectorAll('[data-action]').forEach(b=>b.addEventListener('click',()=>action(b.dataset.action)));
$('next').onclick=()=>{digits='';blank=false;confirmed=false;controls().forEach(b=>b.disabled=false);$('next').hidden=true;$('status').textContent='Novo eleitor fictício habilitado. Digite seu voto.';render();$('display').focus();};
$('finish').onclick=()=>{
 closed=true;controls().forEach(b=>b.disabled=true);$('next').hidden=true;$('finish').hidden=true;$('restart').hidden=false;
 const total=Object.values(tally).reduce((a,b)=>a+b,0);
 $('vote-content').innerHTML='<h3>Votação encerrada</h3><p>Consulte o boletim demonstrativo abaixo.</p>';
 $('bulletin').hidden=false;$('bulletin').innerHTML=`<h3>BOLETIM DEMONSTRATIVO</h3><p>Simulação educativa • sem valor oficial</p><table><caption>Totais desta simulação</caption><tbody><tr><td>12 — Ana do Jardim</td><td>${tally['12']}</td></tr><tr><td>34 — Bruno do Sol</td><td>${tally['34']}</td></tr><tr><td>Brancos</td><td>${tally.blank}</td></tr><tr><td>Nulos</td><td>${tally.null}</td></tr><tr><td><strong>Total confirmado</strong></td><td><strong>${total}</strong></td></tr></tbody></table>`;
 $('status').textContent='Votação encerrada. Apenas votos confirmados entram na contagem. Nenhum resultado foi enviado a um servidor.';
};
$('restart').onclick=()=>{tally={'12':0,'34':0,blank:0,null:0};digits='';blank=confirmed=closed=false;controls().forEach(b=>b.disabled=false);$('restart').hidden=true;$('finish').hidden=false;$('bulletin').hidden=true;$('status').textContent='Nova simulação: todos os contadores foram zerados.';render();$('display').focus();};
$('display').addEventListener('keydown',e=>{if(/^\d$/.test(e.key)){e.preventDefault();digit(e.key);}else if(e.key==='Enter'){e.preventDefault();action('confirm');}else if(e.key==='Backspace'){e.preventDefault();action('correct');}});
render();
