# Hospedagem — guia para o time de infraestrutura

## Resumo

| Item | Valor |
|------|-------|
| Tipo | Site estático (SPA React). **Sem backend, sem banco, sem variáveis de ambiente.** |
| Build | `npm ci && npm run build` → pasta `dist/` |
| Node (só para o build) | 18.18 ou mais novo; recomendado 22 LTS (`.nvmrc`) |
| Imagem pronta | `Dockerfile` (build com Node, serve com `nginx:1.27-alpine`) |
| Porta do container | `8080` |
| Healthcheck | `GET /healthz` → `200 ok` |
| Caminho | Funciona na raiz (`https://qa.empresa/`) ou em subcaminho (`https://intranet/controle-qa/`) **sem rebuild** (build com caminhos relativos) |
| Chamadas externas | Nenhuma. Todo o JS/CSS/ícone vem da própria origem. |

## ⚠️ Antes de publicar: onde ficam os dados

O app grava os dados **no navegador de cada usuário** (`localStorage`, chave.
`qa-equipe-dados`). Hospedar o app **não** cria uma base compartilhada:

- cada pessoa vê só o que ela mesma cadastrou, naquele navegador;
- trocar de máquina/navegador ou limpar os dados do navegador = dados perdidos;
- o compartilhamento hoje é feito exportando `.xlsx` / `.docx`.

Se o objetivo for **uma visão única da equipe para todos**, é preciso um backend
(API + banco) — decisão de produto, fora do escopo deste pacote. O ponto de
troca no código é um só: `src/lib/storage.ts`.

Mudar o **domínio/origem** (ex.: de `http://servidor:8080` para
`https://qa.empresa`) também "zera" a tela para o usuário, porque o
`localStorage` é por origem. Defina a URL final antes de divulgar.

## Opção A — Docker (recomendada)

```bash
docker build -t controle-equipe-qa:1.0.0 .
docker run -d --name controle-equipe-qa -p 8080:8080 --restart unless-stopped controle-equipe-qa:1.0.0
curl -f http://localhost:8080/healthz      # ok
```

- A imagem final tem só nginx + arquivos estáticos (sem Node, sem código-fonte).
- Atrás de proxy reverso/ingress/load balancer: aponte para a porta `8080` do
  container; o TLS (HTTPS) fica no proxy.
- Recursos: o nginx servindo estáticos usa poucos MB de RAM; 0,1 vCPU e
  64 MB são suficientes.

## Opção B — servidor web existente (nginx, Apache, IIS, bucket estático)

1. Gere o build (qualquer máquina com Node):

   ```bash
   npm ci
   npm run build
   ```

2. Copie **o conteúdo** de `dist/` para a pasta publicada.
3. Configure:
   - `index.html` como documento padrão;
   - `index.html` **sem cache** (`Cache-Control: no-cache`) — é ele que aponta
     para a versão nova;
   - `assets/*` com cache longo (`max-age=31536000, immutable`) — os nomes têm
     hash, mudam a cada versão;
   - os cabeçalhos de segurança de `deploy/nginx.conf` (CSP, `X-Frame-Options`,
     `nosniff`, `Referrer-Policy`).

   Para nginx, `deploy/nginx.conf` já está pronto (ajuste `listen`/`root`).

## Atualizar para uma versão nova

- **Docker:** `git pull`, `docker build` com a nova tag, troque o container.
- **Estático:** `git pull`, `npm ci`, `npm run build`, substitua o conteúdo
  publicado por `dist/` novo (apague os `assets/` antigos depois que a nova
  versão estiver no ar).

Os dados dos usuários não são afetados por atualização (ficam no navegador),
desde que o domínio continue o mesmo.

## Segurança

- `deploy/nginx.conf` envia CSP restritiva (`default-src 'self'`, sem scripts
  externos nem inline), `X-Frame-Options: DENY`, `nosniff`,
  `Referrer-Policy` e `Permissions-Policy`; `server_tokens off`.
- O app não envia dados para lugar nenhum; exportações são geradas no próprio
  navegador.
- Sem autenticação: quem acessa a URL usa o app (cada um com os próprios
  dados locais). Se precisar restringir acesso, faça no proxy (SSO/VPN/rede
  interna).
- `npm audit --omit=dev` (dependências que vão para produção): **0
  vulnerabilidades**. O `npm audit` completo aponta 2 itens só de
  desenvolvimento (servidor do `npm run dev`/esbuild), que não entram no
  build nem na imagem.
- A biblioteca `xlsx` vem do CDN oficial da SheetJS
  (`cdn.sheetjs.com`, versão 0.20.3), não do npm: a versão do npm (0.18.5) tem
  vulnerabilidades sem correção lá. O build precisa de acesso a
  `registry.npmjs.org` **e** `cdn.sheetjs.com`. Em rede restrita, libere os
  dois ou use um mirror interno.

## CI

`.github/workflows/ci.yml` roda a cada push/PR:

- `npm run check` (tipos + lint + build) em **Ubuntu, macOS e Windows**;
- build da imagem Docker, sobe o container e confere `/healthz` e a página.

## Arquivos de hospedagem

| Arquivo | Para quê |
|---------|----------|
| `Dockerfile` | imagem de produção (multi-stage) |
| `.dockerignore` | mantém `node_modules`/`.git` fora do contexto do build |
| `deploy/nginx.conf` | servidor: SPA, cache, gzip, cabeçalhos de segurança, `/healthz` |
| `.nvmrc` | versão do Node para o build |
| `.github/workflows/ci.yml` | checagem automática |
