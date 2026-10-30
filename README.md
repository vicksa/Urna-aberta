# Urna Aberta

Site educativo em português sobre o funcionamento, a segurança e a fiscalização das urnas eletrônicas brasileiras. Projeto independente, sem vínculo com o TSE.

## Recursos

- Explicação da preparação, zerésima, votação, boletim e totalização.
- Simulador simplificado para um cargo, com candidatos fictícios, branco, nulo, correção e confirmação.
- Vários eleitores simulados, encerramento, boletim demonstrativo e reinício.
- Camadas de segurança com explicações sobre alcance e limites.
- Layout responsivo, navegação por teclado e fontes oficiais.

## Executar

Abra `index.html` no navegador ou execute `python3 -m http.server 8000` na pasta do projeto e acesse http://localhost:8000.

Sem instalação, compilação ou backend. Os votos ficam somente na memória da página e são apagados ao recarregar. O simulador não implementa os mecanismos de segurança de uma urna real. Fontes Google são opcionais; há fontes alternativas locais no CSS.

## Publicação

GitHub Pages publica os arquivos estáticos da raiz da branch `main`. O workflow `.github/workflows/pages.yml` automatiza a publicação.

## Fontes

- https://www.justicaeleitoral.jus.br/urna-eletronica/
- https://www.justicaeleitoral.jus.br/urna-eletronica/oportunidades-de-auditoria-e-fiscalizacao.html
- https://www.justicaeleitoral.jus.br/urna-eletronica/detalhes-tecnicos-da-urna.html
- https://www.tse.jus.br/eleicoes/tpu

Consulte os procedimentos oficiais vigentes de cada eleição. Nenhum sistema é apresentado como infalível.
