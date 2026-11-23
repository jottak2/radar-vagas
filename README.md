# Radar de Vagas · Jottak2

Página pessoal com as vagas de **Diretor de Arte Jr** e **Designer Gráfico** (júnior, pleno e sênior) encontradas no LinkedIn.

- **Filtros:** em São Paulo, qualquer modalidade (presencial, híbrido ou home office); fora de SP, só remoto.
- **Fonte dos dados:** a planilha de vagas no Claude (link no botão "Abrir planilha").
- **Atualização:** uma tarefa agendada do Claude roda todo dia antes das 9h, busca as vagas novas, atualiza a planilha e regrava `data/vagas.js`.

## Arquivos

| Arquivo | O que é |
| --- | --- |
| `index.html` | A página |
| `assets/style.css` | Visual |
| `assets/app.js` | Monta os cards, filtros e contadores a partir dos dados |
| `data/vagas.js` | Os dados das vagas (gerado automaticamente, não edite à mão) |
| `scripts/gerar_vagas.py` | Converte a leitura da planilha em `data/vagas.js` |

## Publicar no GitHub Pages

1. No GitHub Desktop, **Publish repository**.
2. No GitHub, abra o repositório → **Settings → Pages** → *Source: Deploy from a branch* → `main` / `/ (root)` → **Save**.
3. Em um ou dois minutos a página fica no ar em `https://jottak2.github.io/NOME-DO-REPOSITORIO/`.

Para ver no computador sem publicar, basta abrir o `index.html` no navegador.
