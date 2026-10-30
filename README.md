# Urna Aberta

Site educativo independente em português sobre o funcionamento, a segurança e a fiscalização das urnas brasileiras. Sem vínculo com o TSE.

## Duas experiências

- **Simulador educativo:** teclado, candidatos fictícios, branco, nulo, correção e boletim local. Não envia votos a um servidor.
- **Votação coletiva:** consultas criadas no painel, códigos de uso único, votos persistidos em PostgreSQL e resultado público somente após encerramento. Todos os participantes usam o mesmo link com `?id=...`.

## Colocar a votação coletiva no ar

O GitHub Pages serve a parte estática. A API precisa de uma hospedagem com Node.js, como a Vercel, e de um PostgreSQL Neon. O repositório contém a função em `api/election.js` e a configuração de publicação.

1. Importe este repositório na Vercel (framework `Other`, build `npm run build`, saída `public`). O projeto `urna-aberta` já foi criado na conta conectada durante a implementação.
2. Em **Storage**, conecte um banco **Neon** ao projeto. Escolha a região São Paulo (`gru1`) se disponível e um plano adequado ao uso. Confirme que a integração injeta **DATABASE_URL** no ambiente **Production**. Se houver apenas `POSTGRES_URL`, configure `DATABASE_URL` com a conexão do Neon no painel, sem colocar o valor no código ou no chat.
3. Em **Settings → Environment Variables**, defina **ADMIN_PASSWORD** como uma senha exclusiva com pelo menos 16 caracteres, apenas no servidor. Nunca use prefixo `PUBLIC` ou `NEXT_PUBLIC` para essa senha nem para o banco.
4. Faça **Redeploy**. As tabelas do projeto (`ua_elections`, `ua_tokens`, `ua_limits`) são criadas automaticamente na primeira requisição com o banco disponível. O usuário do banco precisa poder criá-las.
5. Abra `/admin.html`, entre com a senha e crie a consulta.
6. Gere e baixe os códigos **antes** de abrir a votação. Entregue apenas um código por pessoa; não publique a lista nem a coloque no link.
7. Abra a votação e compartilhe o link gerado pelo painel. Ao encerrar, o mesmo link exibe o resultado.

Os códigos completos são mostrados somente na geração. Uma votação encerrada não pode ser reaberta ou zerada. Crie outra para uma nova consulta.

### Usar também o GitHub Pages

Edite somente o endereço público `window.URNA_API_ORIGIN` em `config.js` para o domínio de produção da Vercel, por exemplo `https://seu-projeto.vercel.app` (sem barra final). Deixe vazio quando site e API estão no mesmo domínio. Não configure URLs de preview com autenticação obrigatória. A API aceita a origem `https://vicksa.github.io` e a própria origem.

O workflow de Pages publica apenas `public/`, sem `node_modules`, biblioteca de servidor ou arquivos `.env`. Nunca insira credenciais em arquivos do frontend.

## Desenvolvimento

Requer Node.js 22 ou superior.

```sh
npm ci
npm test
npm run build
```

Para executar a aplicação com um banco de desenvolvimento separado, preencha `.env.local` a partir de `.env.example` e use:

```sh
node --env-file=.env.local scripts/dev.mjs
```

Acesse http://localhost:8000. Sem banco, o site e o simulador continuam disponíveis e a votação coletiva mostra uma mensagem de configuração pendente. Não existe fallback que finja ter registrado votos no servidor.

## Como os votos são tratados

- Cada código tem 128 bits aleatórios; o banco guarda apenas seu SHA-256.
- Um comando atômico PostgreSQL consome o código e incrementa a contagem. Falha na contagem reverte o consumo.
- O identificador aleatório de envio permite repetir uma confirmação após falha de conexão sem duplicar o voto.
- Não existe tabela de votos individuais, nem coluna que associe código à escolha. São armazenados totais agregados por opção, códigos consumidos e identificadores de envio.
- A API não solicita nome, CPF ou título, nem registra os corpos de requisição nos logs. A hospedagem pode reter metadados técnicos de acesso.
- Tentativas inválidas de senha são limitadas por janela de dez minutos. O identificador de rede usado para essa limitação é armazenado como HMAC, com expiração, sem IP em texto.
- Resultados por opção só são expostos após encerramento. Enquanto aberta, a consulta mostra apenas a quantidade total de participações.

**Limites:** códigos controlam uso, não identidade; uma pessoa com vários códigos pode votar várias vezes. O organizador controla a distribuição e o encerramento, e administradores da hospedagem/banco têm acesso técnico privilegiado. A aplicação não fornece anonimato criptográfico, defesa completa contra tráfego abusivo, certificação eleitoral ou as garantias de uma urna oficial. Use para consultas educativas com candidatos fictícios.

## Verificação

`npm test` executa os comandos SQL reais em PostgreSQL embutido (PGlite): ciclo completo, consumo único, idempotência, voto após encerramento, falha atômica, estrutura sem associação código/escolha, autorização, CORS e indisponibilidade. Isso não substitui um teste com várias instâncias contra o Neon em produção.

## Fontes do conteúdo educativo

- https://www.justicaeleitoral.jus.br/urna-eletronica/
- https://www.justicaeleitoral.jus.br/urna-eletronica/oportunidades-de-auditoria-e-fiscalizacao.html
- https://www.justicaeleitoral.jus.br/urna-eletronica/detalhes-tecnicos-da-urna.html
- https://www.tse.jus.br/eleicoes/tpu

Consulte os procedimentos oficiais vigentes de cada eleição.
