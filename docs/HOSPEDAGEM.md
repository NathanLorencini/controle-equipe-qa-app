# Hospedagem — guia para o time de infraestrutura

## Resumo

| Item | Valor |
|------|-------|
| Tipo | SPA React + servidor Node (login + API + banco **SQLite** embutido no Node). Um processo, um container. |
| Dependências de produção | Nenhuma: só o Node (o `node:sqlite` vem com ele). |
| Node | 22.13 ou mais novo; recomendado **24 LTS** (`.nvmrc`). A imagem usa `node:24-alpine`. |
| Imagem pronta | `Dockerfile` (build com Node, roda com Node, usuário sem privilégio `node`) |
| Porta | `8080` (variável `PORT`) |
| Banco | arquivo SQLite em `/data/controle.db` (variável `DB_PATH`) — **precisa de volume** |
| Login | usuário e senha no próprio app; sessão por cookie `HttpOnly`, `SameSite=Strict`, 12 h |
| Healthcheck | `GET /healthz` → `200 ok` (público) |
| Caminho | Raiz (`https://qa.empresa/`) ou subcaminho (`https://intranet/controle-qa/`) **sem rebuild** |
| Chamadas externas | Nenhuma. |

## ⚠️ Antes de publicar

1. **Volume para `/data`.** O banco guarda os usuários e os dados da equipe. Sem
   volume, **tudo some** (inclusive os logins) a cada troca de container.
2. **Uma instância só por banco.** Duas réplicas escrevendo no mesmo arquivo
   (ou volume de rede NFS/SMB) podem corromper o SQLite.
3. **HTTPS no proxy**, repassando `X-Forwarded-Proto: https` — com ele o cookie
   de sessão sai com `Secure`. Sem proxy HTTPS, defina `COOKIE_SECURE=1` só se o
   acesso for 100% HTTPS (em HTTP puro o navegador recusaria o cookie).
4. **Criar os usuários** (abaixo). Sem usuário ninguém entra; o servidor avisa no
   log ao subir com o banco vazio.

## Opção A — Docker (recomendada)

```bash
docker build -t controle-equipe-qa:2.0.0 .
docker volume create controle-equipe-qa-dados
docker run -d --name controle-equipe-qa -p 8080:8080 \
  -v controle-equipe-qa-dados:/data --restart unless-stopped controle-equipe-qa:2.0.0
curl -f http://localhost:8080/healthz      # ok
```

Recursos: 0,25 vCPU e 128 MB são suficientes para uma equipe.

## Opção B — Node direto (VM, sem Docker)

```bash
npm ci
npm run build
PORT=8080 DB_PATH=/var/lib/controle-equipe-qa/controle.db npm start
```

Rode como serviço (systemd, PM2, NSSM no Windows) com usuário sem privilégio e
escrita **só** na pasta do banco.

## Usuários

Gerenciados por linha de comando **no servidor**, no mesmo banco do app. A senha
é digitada sem aparecer na tela — **nunca vai na linha de comando** (ficaria no
histórico e no `ps`). Senha criada ou redefinida aqui é **provisória**: a pessoa
cria a própria no primeiro acesso.

```bash
# Docker
docker exec -it controle-equipe-qa node server/usuarios.mjs criar <usuario>
docker exec -it controle-equipe-qa node server/usuarios.mjs listar
docker exec -it controle-equipe-qa node server/usuarios.mjs senha <usuario>     # esqueceu a senha
docker exec -it controle-equipe-qa node server/usuarios.mjs remover <usuario>

# Node direto
DB_PATH=/var/lib/controle-equipe-qa/controle.db npm run usuarios -- criar <usuario>
```

Usuários iniciais da equipe: **lais**, **romario**, **nathan**, **johnny**. As
senhas provisórias são passadas pelo responsável do projeto por canal privado,
**não** por este repositório.

- Usuário: 2 a 40 caracteres (letras, números, `.`, `-`, `_`), sem diferença de
  maiúscula. Senha: mínimo 8 caracteres.
- `senha <usuario>` derruba as sessões abertas dessa pessoa.
- 5 senhas erradas bloqueiam o usuário por 5 min; 30 erros do mesmo IP
  bloqueiam o IP (atrás do proxy a equipe toda tem o mesmo IP, por isso o limite
  por IP é alto).

## Backup

O banco tem **usuários (hash das senhas) e dados** — trate o backup como
confidencial.

- Arquivo completo, com o app rodando (o destino não pode existir):

  ```bash
  docker exec controle-equipe-qa rm -f /data/backup.db
  docker exec controle-equipe-qa node -e "new (require('node:sqlite').DatabaseSync)('/data/controle.db').exec(\"VACUUM INTO '/data/backup.db'\")"
  docker cp controle-equipe-qa:/data/backup.db ./controle-$(date +%F).db
  ```

  Copiar só o `.db` com o app rodando pode perder o que está no `-wal`.
- Só os dados da equipe, em JSON (exige sessão): `GET /api/backup` logado no app.

Sugestão: backup diário do arquivo com retenção de 30 dias.

## Atualizar para uma versão nova

- **Docker:** `git pull`, `docker build` com a nova tag, troque o container
  **montando o mesmo volume**. O banco se ajusta sozinho na subida.
- **Node direto:** `git pull`, `npm ci`, `npm run build`, reinicie o serviço.

## Rotas

| Método | Rota | Sessão | Para quê |
|--------|------|--------|----------|
| GET | `/healthz` | não | healthcheck |
| GET | `/` e demais caminhos | não | a tela (mostra o login) |
| POST | `/api/login` | não | `{usuario, senha}` → cookie de sessão |
| POST | `/api/logout` | — | encerra a sessão |
| GET | `/api/eu` | sim | usuário logado e se a senha é provisória |
| POST | `/api/senha` | sim | `{atual, nova}` troca a própria senha |
| GET | `/api/dados`, `/api/versao`, `/api/backup` | sim | leitura |
| POST/PATCH/DELETE | `/api/membros…`, `/api/projetos…`, `/api/importar` | sim | gravação (registra quem alterou) |

Com senha provisória, só `/api/eu`, `/api/senha` e `/api/logout` respondem.

## Segurança

- Senhas só como hash **scrypt** com sal por usuário; comparação em tempo
  constante; usuário inexistente gasta o mesmo tempo que senha errada.
- Sessão: token aleatório de 256 bits no cookie; o banco guarda só o hash dele.
- Gravação: exige JSON, `SameSite=Strict` e confere o `Origin` (contra CSRF).
- Cabeçalhos: CSP restritiva (`default-src 'self'`), `X-Frame-Options: DENY`,
  `nosniff`, `Referrer-Policy`, `Permissions-Policy`.
- Entrada validada no servidor, corpo limitado a 1 MB, SQL só com parâmetros,
  arquivos servidos só de `dist/`.
- A biblioteca `xlsx` vem do CDN oficial da SheetJS (`cdn.sheetjs.com`, 0.20.3);
  o build precisa de acesso a `registry.npmjs.org` **e** `cdn.sheetjs.com`.

## CI

`.github/workflows/ci.yml` roda a cada push/PR:

- `npm run check` (tipos + lint + testes do servidor + build) em **Ubuntu, macOS e Windows**;
- imagem Docker: sobe com volume, confere que a API exige login, cria usuário,
  entra, grava, troca o container e confere que usuário e dado continuam lá.

## Arquivos de hospedagem

| Arquivo | Para quê |
|---------|----------|
| `Dockerfile` | imagem de produção (multi-stage, usuário `node`, volume `/data`) |
| `.dockerignore` | mantém `node_modules`, `.git` e `dados/` fora da imagem |
| `server/index.mjs` | servidor: tela, login, API, cabeçalhos de segurança, `/healthz` |
| `server/banco.mjs` | banco SQLite (usuários, sessões, QAs, projetos) |
| `server/usuarios.mjs` | criar, listar, redefinir senha e remover usuários |
| `.nvmrc` | versão do Node |
| `.github/workflows/ci.yml` | checagem automática |
