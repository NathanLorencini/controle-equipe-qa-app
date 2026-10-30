# Controle Equipe QA

App web para acompanhar a equipe de QA: cada QA com seus projetos, a situação de
cada projeto, o percentual de foco e os prós e contras para o QA. Exporta para
Excel (`.xlsx`) e Word (`.docx`). Tem **login**, e todos que entram veem e
editam a **mesma base**: o que uma pessoa cadastra aparece para as outras em
até 5 segundos.

Feito com Vite + React + TypeScript + TailwindCSS; o servidor é Node puro com o
SQLite embutido no Node (sem dependência). Roda igual no **Mac** e no **Windows**.

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

   Sobe duas coisas juntas: a API (porta 3001, banco de teste em
   `dados/dev.db`) e a tela.
3. **Só na primeira vez**, crie um usuário para você no banco de teste (em
   outro terminal, na mesma pasta; a senha é pedida sem aparecer na tela):

   ```bash
   DB_PATH=dados/dev.db npm run usuarios -- criar seu-nome
   ```

   No Windows (PowerShell): `$env:DB_PATH="dados/dev.db"; npm run usuarios -- criar seu-nome`.
4. Abra no navegador o endereço que aparecer, normalmente
   **http://localhost:5173** (no Mac, `⌘ + clique` no link abre direto), e entre
   com o usuário criado.
5. Para desligar: `Ctrl + C` no terminal (desliga as duas).

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

### Login

O app pede **usuário e senha**. No primeiro acesso a senha é provisória e o app
pede para criar uma senha só sua (mínimo 8 caracteres). No topo ficam
**Trocar senha** e **Sair**. Esqueceu a senha? Peça para quem administra o
servidor rodar `usuarios.mjs senha <seu-usuario>` (ver
[`docs/HOSPEDAGEM.md`](docs/HOSPEDAGEM.md#usuários)).

5 senhas erradas seguidas bloqueiam o usuário por 5 minutos.

### Onde ficam os dados

Os dados ficam **no servidor**, numa base única para todos que fazem login:

- o que você cadastra, os outros veem — e vice-versa — sem precisar dar F5;
- cada edição grava só o campo alterado: duas pessoas mexendo em campos
  diferentes ao mesmo tempo não apagam o trabalho uma da outra (no **mesmo**
  campo, vale a última gravação); o banco registra quem fez cada alteração;
- o canto superior direito mostra **Salvo**, **Salvando…** ou **Sem conexão**.
  Sem conexão, o que você digitou fica guardado na tela e é gravado quando a
  conexão volta — não feche a aba enquanto aparecer *Sem conexão*;
- remover um QA ou projeto remove **para todos**.

**Versão antiga (dados só no navegador):** se o seu navegador tiver dados da
versão anterior, aparece o aviso *Este navegador tem N QA(s) salvos…* com o
botão **Enviar para a base compartilhada**. O envio **acrescenta** (não apaga
nada da base) e os dados antigos continuam no navegador como cópia.

## 5. Atualizar para a versão mais nova

Na pasta do projeto:

```bash
git pull
npm install
npm run dev
```

O `npm install` depois do `git pull` garante que dependências novas sejam
baixadas.

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

A pasta `dist/` é a tela (HTML, CSS e JS); o `npm start` serve ela junto do
login e da API. Como hospedar: [`docs/HOSPEDAGEM.md`](docs/HOSPEDAGEM.md).

## Comandos

| Comando           | O que faz                                    |
|-------------------|----------------------------------------------|
| `npm install`     | baixa as dependências (depois de clonar ou de `git pull`) |
| `npm run dev`     | sobe API + tela em modo desenvolvimento      |
| `npm start`       | sobe o servidor de produção (tela + login + API na porta 8080) |
| `npm run usuarios -- <comando>` | `listar`, `criar <usuario>`, `senha <usuario>`, `remover <usuario>` |
| `npm test`        | testes do servidor (login, base, segurança)  |
| `npm run build`   | confere os tipos e gera a versão final em `dist/` |
| `npm run preview` | serve o `dist/` para conferir o build        |
| `npm run typecheck` | confere os tipos do TypeScript             |
| `npm run lint`    | confere o código com o ESLint                |
| `npm run check`   | tipos, lint, testes e build de uma vez (o mesmo que o CI roda) |

## Problemas comuns

| Problema | Solução |
|----------|---------|
| `node: command not found` / `npm não é reconhecido` | Instale o Node.js (passo 1) e abra um terminal novo. |
| `Permission denied` ou erro de `esbuild` | A pasta `node_modules` veio de outra máquina. Apague e reinstale — Mac: `rm -rf node_modules && npm install`; Windows: `Remove-Item -Recurse -Force node_modules; npm install`. |
| `Port 5173 is in use` | Outro app está na porta; o Vite usa a próxima livre (5174…). Use o endereço que ele mostrar. |
| No Windows, o PowerShell bloqueia o `npm` ("execução de scripts desabilitada") | Rode uma vez: `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned`. |
| *Sem conexão com o servidor* | Em desenvolvimento, a API não subiu: use `npm run dev` (e não `npx vite`). Em produção, avise a infra. |
| *Usuário ou senha incorretos* no ambiente de desenvolvimento | O banco de teste (`dados/dev.db`) é outro: crie o usuário nele (passo 3 de *Subir o app*). |
| *Muitas tentativas erradas* | Espere 5 minutos. Esqueceu a senha: `npm run usuarios -- senha <usuario>`. |
| `node:sqlite` não encontrado | Node antigo. Precisa do 22.13 ou mais novo (recomendado 24). |

## Estrutura do projeto

```
├── src/
│   ├── main.tsx                 entrada do React
│   ├── App.tsx                  porta de entrada: login → troca de senha → controle
│   ├── types.ts                 Membro, Projeto e as situações possíveis
│   ├── components/
│   │   ├── ControleEquipeQA.tsx tela principal (lista, busca, exportação)
│   │   ├── CardMembro.tsx       card de um QA
│   │   ├── CardProjeto.tsx      formulário de um projeto
│   │   ├── Login.tsx            tela de login
│   │   └── TrocarSenha.tsx      troca de senha (obrigatória no 1º acesso)
│   ├── lib/
│   │   ├── api.ts               chamadas à API (login e dados)
│   │   ├── useBaseCompartilhada.ts  sincronização (gravar, recarregar, sem conexão)
│   │   ├── dados.ts             normalização e leitura dos dados antigos do navegador
│   │   ├── storage.ts           acesso ao localStorage (só para a importação)
│   │   └── exportar.ts          geração dos .xlsx e .docx
│   └── types/global.d.ts
├── server/
│   ├── index.mjs                servidor: tela (dist/) + login + API /api/*
│   ├── banco.mjs                banco SQLite (usuários, sessões, QAs, projetos)
│   ├── usuarios.mjs             criar/listar/redefinir/remover usuários
│   └── servidor.test.mjs        testes (npm test)
├── scripts/dev.mjs              npm run dev: API + Vite juntos
├── public/favicon.svg
├── Dockerfile                   imagem de produção
├── docs/HOSPEDAGEM.md           guia para a infra
└── .github/workflows/ci.yml     checagem em Mac, Windows e Linux
```

## Notas técnicas

- Sincronização: a tela pergunta a versão da base a cada 5 s (`GET api/versao`)
  e recarrega quando mudou; o que ainda não foi gravado é mantido por cima.
  Texto grava 0,6 s depois da última tecla; seleção e número, na hora.
- Senhas: hash scrypt; sessão em cookie `HttpOnly`/`SameSite=Strict` de 12 h.
  Detalhes de segurança em [`docs/HOSPEDAGEM.md`](docs/HOSPEDAGEM.md#segurança).
- A biblioteca `xlsx` vem do CDN oficial da SheetJS (a versão do npm tem
  vulnerabilidades sem correção). O `npm install` baixa de lá sozinho.
- `.gitattributes` mantém o fim de linha igual (LF) no Mac e no Windows, para
  não aparecer diferença falsa no arquivo inteiro.
