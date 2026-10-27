# Controle Equipe QA

App web para acompanhar a equipe de QA: cada QA com seus projetos, a situação de
cada projeto, o percentual de foco e os prós e contras para o QA. Exporta para
Excel (`.xlsx`) e Word (`.docx`).

Feito com Vite + React + TypeScript + TailwindCSS. Roda igual no **Mac** e no
**Windows**.

> **Hospedar o app (time de infra):** veja [`docs/HOSPEDAGEM.md`](docs/HOSPEDAGEM.md).

---

## 1. Requisitos (uma vez por máquina)

1. **Node.js 18 ou mais novo** — baixe a versão **LTS** em https://nodejs.org e instale.
2. **Git** — no Mac já vem (se pedir, aceite instalar as *Command Line Tools*);
   no Windows, instale em https://git-scm.com.
3. Confira no terminal (Mac: **Terminal**; Windows: **PowerShell**):

   ```bash
   node -v
   git --version
   ```

   Os dois devem mostrar um número de versão.

## 2. Baixar o projeto (uma vez)

```bash
git clone https://github.com/NathanLorencini/controle-equipe-qa-app.git
cd controle-equipe-qa-app
npm install
```

O `npm install` baixa as dependências certas para o seu sistema (Mac ou
Windows). Não precisa apagar nem copiar nada.

## 3. Subir o app (toda vez que for usar)

1. Abra o terminal na pasta do projeto:

   ```bash
   cd controle-equipe-qa-app
   ```

2. Suba o app:

   ```bash
   npm run dev
   ```

3. Abra no navegador o endereço que aparecer, normalmente
   **http://localhost:5173** (no Mac, `⌘ + clique` no link abre direto).
4. Para desligar: `Ctrl + C` no terminal.

## 4. Como usar

1. **Adicionar um QA** — digite o nome no campo *Nome do QA* e clique em
   **Adicionar QA** (ou aperte `Enter`).
2. **Abrir o QA** — clique em **Expandir** no card dele.
3. **Adicionar projeto** — clique em **Adicionar Projeto** e preencha:
   - **Nome do Projeto**;
   - **Situação Atual**: Planejamento, Em Andamento, Testes, Homologação,
     Concluído ou Pausado;
   - **Percentual de Foco (%)** — quanto do tempo do QA vai para o projeto;
   - **Prós** e **Contras** para o QA.
4. **Total de Foco** — o card soma o foco de todos os projetos do QA. Passou
   de 100%, aparece o aviso *O foco total excede 100%*.
5. **Remover** — **Remover Projeto** apaga o projeto do QA.
6. **Pesquisar** — o campo *Pesquisar QA por nome* filtra a lista.
7. **Exportar**
   - **Exportar .xlsx** / **Exportar .docx** (no topo): a equipe inteira.
   - **Exportar QA .xlsx** / **Exportar QA .docx** (dentro do card): só aquele QA.

### Onde ficam os dados

Os dados ficam salvos **no navegador da sua máquina** (`localStorage`). Por isso:

- outra pessoa, outro computador ou outro navegador **não vê** os seus dados;
- limpar os dados do navegador (ou usar janela anônima) **apaga** tudo;
- para guardar ou compartilhar, use **Exportar .xlsx / .docx**.

## 5. Atualizar para a versão mais nova

Na pasta do projeto:

```bash
git pull
npm install
npm run dev
```

O `npm install` depois do `git pull` garante que dependências novas sejam
baixadas. Os dados salvos no navegador não são afetados.

## 6. Subir alterações para o GitHub

Fez mudanças no código e quer enviar para o repositório:

1. Veja o que mudou:

   ```bash
   git status
   ```

2. Confira que está tudo certo (tipos, lint e build):

   ```bash
   npm run check
   ```

3. Adicione, registre e envie:

   ```bash
   git add .
   git commit -m "Descreva aqui o que mudou"
   git push
   ```

4. Se o `git push` recusar porque alguém subiu antes, traga as mudanças e envie
   de novo:

   ```bash
   git pull
   git push
   ```

A pasta `node_modules/` e o build (`dist/`) **nunca** vão para o GitHub — o
`.gitignore` já cuida disso, o `git add .` não os inclui.

## 7. Gerar a versão final (build)

```bash
npm run build     # gera a pasta dist/
npm run preview   # serve o dist/ para conferir no navegador
```

A pasta `dist/` é um site estático (HTML, CSS e JS). Como hospedar (Docker ou
servidor web): [`docs/HOSPEDAGEM.md`](docs/HOSPEDAGEM.md).

## Comandos

| Comando           | O que faz                                    |
|-------------------|----------------------------------------------|
| `npm install`     | baixa as dependências (depois de clonar ou de `git pull`) |
| `npm run dev`     | sobe o app em modo desenvolvimento           |
| `npm run build`   | confere os tipos e gera a versão final em `dist/` |
| `npm run preview` | serve o `dist/` para conferir o build        |
| `npm run typecheck` | confere os tipos do TypeScript             |
| `npm run lint`    | confere o código com o ESLint                |
| `npm run check`   | tudo acima de uma vez (o mesmo que o CI roda) |

## Problemas comuns

| Problema | Solução |
|----------|---------|
| `node: command not found` / `npm não é reconhecido` | Instale o Node.js (passo 1) e abra um terminal novo. |
| `Permission denied` ou erro de `esbuild` | A pasta `node_modules` veio de outra máquina. Apague e reinstale — Mac: `rm -rf node_modules && npm install`; Windows: `Remove-Item -Recurse -Force node_modules; npm install`. |
| `Port 5173 is in use` | Outro app está na porta; o Vite usa a próxima livre (5174…). Use o endereço que ele mostrar. |
| No Windows, o PowerShell bloqueia o `npm` ("execução de scripts desabilitada") | Rode uma vez: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |
| Os dados sumiram | Foram salvos em outro navegador/máquina ou o navegador foi limpo. Veja *Onde ficam os dados*. |

## Estrutura do projeto

```
├── src/
│   ├── main.tsx                 entrada do React
│   ├── App.tsx
│   ├── types.ts                 Membro, Projeto e as situações possíveis
│   ├── components/
│   │   ├── ControleEquipeQA.tsx tela principal (lista, busca, exportação)
│   │   ├── CardMembro.tsx       card de um QA
│   │   └── CardProjeto.tsx      formulário de um projeto
│   ├── lib/
│   │   ├── storage.ts           onde os dados ficam (localStorage ou window.storage)
│   │   ├── dados.ts             carregar/salvar e normalizar os dados
│   │   └── exportar.ts          geração dos .xlsx e .docx
│   └── types/global.d.ts
├── public/favicon.svg
├── deploy/nginx.conf            servidor de produção
├── Dockerfile                   imagem de produção
├── docs/HOSPEDAGEM.md           guia para a infra
└── .github/workflows/ci.yml     checagem em Mac, Windows e Linux
```

## Notas técnicas

- `src/lib/storage.ts` usa `window.storage` quando o ambiente oferece
  (Electron, Capacitor, extensão) e cai para `localStorage` no navegador.
- A biblioteca `xlsx` vem do CDN oficial da SheetJS (a versão do npm tem
  vulnerabilidades sem correção). O `npm install` baixa de lá sozinho.
- `.gitattributes` mantém o fim de linha igual (LF) no Mac e no Windows, para
  não aparecer diferença falsa no arquivo inteiro.
