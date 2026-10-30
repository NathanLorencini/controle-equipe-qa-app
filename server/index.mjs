/**
 * Servidor do Controle Equipe QA: entrega o site (dist/), o login e a API da
 * base compartilhada (/api/*). Sem dependencias: so o Node (>= 22.13, por
 * causa do `node:sqlite`).
 *
 *   PORT=8080 DB_PATH=./dados/controle.db node server/index.mjs
 *
 * Toda rota /api/* exige sessao, menos /api/login. A tela (dist/) e publica:
 * e ela que mostra o formulario de login.
 */
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abreBanco, ErroDeEntrada, SESSAO_HORAS } from './banco.mjs';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));
const MAX_CORPO = 1024 * 1024;
const COOKIE = 'controle_sessao';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png',
  '.ico': 'image/x-icon', '.json': 'application/json', '.woff2': 'font/woff2', '.txt': 'text/plain',
};

// Os mesmos cabecalhos que o deploy/nginx.conf mandava.
const SEGURANCA = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    + "img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'",
};

// ------------------------------------------------------- tentativas de login
/**
 * 5 senhas erradas para o mesmo usuario bloqueiam ESSE usuario por 5 min. Por
 * IP o limite e 30: atras do proxy ou da rede do escritorio a equipe inteira
 * chega pelo mesmo IP, e uma pessoa errando a senha nao pode trancar todas.
 */
const TENTATIVAS_MAX = { u: 5, ip: 30 };
const BLOQUEIO_MS = 5 * 60 * 1000;
const falhas = new Map();

function bloqueado(chaves) {
  const agora = Date.now();
  return chaves.some((k) => {
    const f = falhas.get(k);
    return f && f.n >= TENTATIVAS_MAX[k.split(':')[0]] && agora - f.ultima < BLOQUEIO_MS;
  });
}

function registraFalha(chaves) {
  const agora = Date.now();
  for (const k of chaves) {
    const f = falhas.get(k);
    const n = f && agora - f.ultima < BLOQUEIO_MS ? f.n + 1 : 1;
    falhas.set(k, { n, ultima: agora });
  }
}

// ------------------------------------------------------------------ http
function responde(res, status, corpo, cabecalhos = {}) {
  res.writeHead(status, { ...SEGURANCA, ...cabecalhos });
  res.end(corpo);
}

function json(res, status, dados, cabecalhos = {}) {
  responde(res, status, JSON.stringify(dados),
    { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', ...cabecalhos });
}

async function leCorpo(req) {
  const partes = [];
  let total = 0;
  for await (const p of req) {
    total += p.length;
    if (total > MAX_CORPO) throw new ErroDeEntrada('corpo da requisição grande demais');
    partes.push(p);
  }
  if (!total) return {};
  try {
    return JSON.parse(Buffer.concat(partes).toString('utf8'));
  } catch {
    throw new ErroDeEntrada('JSON inválido');
  }
}

function tokenDoCookie(req) {
  for (const parte of String(req.headers.cookie || '').split(';')) {
    const [k, ...v] = parte.trim().split('=');
    if (k === COOKIE) return v.join('=');
  }
  return '';
}

/**
 * Cookie `Secure` so quando a pessoa chega por HTTPS (direto ou pelo proxy, via
 * X-Forwarded-Proto): em HTTP o navegador recusaria o cookie e o login nunca
 * pegaria. COOKIE_SECURE=1 forca sempre.
 */
function cookie(req, valor, maxAge, caminhoBase) {
  const https = process.env.COOKIE_SECURE === '1' || req.socket.encrypted
    || String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim() === 'https';
  return `${COOKIE}=${valor}; Path=${caminhoBase || '/'}; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${https ? '; Secure' : ''}`;
}

/**
 * Gravacao vinda de outro site: o navegador manda o cookie junto, entao a API
 * confere a origem. Com SameSite=Strict e JSON obrigatorio isso e a terceira
 * barreira, nao a unica.
 */
function origemEstranha(req) {
  const origem = req.headers.origin;
  if (!origem) return false;
  try {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    return new URL(origem).host !== String(host).split(',')[0].trim();
  } catch {
    return true;
  }
}

/**
 * QUEM PODE O QUE (30/10/2026). Todos os logados VEEM tudo; gravar depende:
 *   admin  -- tudo;
 *   gestor -- cria e remove QAs; nos projetos, so os do proprio QA;
 *   qa     -- so os projetos do proprio QA (o QA de que e dono).
 * QA sem dono so o admin edita. A regra vale aqui, no servidor: a tela so
 * esconde o que a pessoa nao pode, quem chama a API direto ouve 403.
 */
export function pode(quem, acao, donoDoQa = null) {
  if (quem.perfil === 'admin') return true;
  if (acao === 'criar-qa' || acao === 'remover-qa' || acao === 'listar-usuarios') return quem.perfil === 'gestor';
  if (acao === 'editar-qa') return donoDoQa !== null && donoDoQa === quem.id;
  return false; // vincular dono, importar, backup: so admin
}

const NEGADO = {
  'criar-qa': 'só o administrador ou o gestor criam QAs',
  'remover-qa': 'só o administrador ou o gestor removem QAs',
  'editar-qa': 'você só pode alterar o seu próprio QA',
  'vincular-qa': 'só o administrador troca o dono de um QA',
  importar: 'só o administrador importa dados',
  backup: 'só o administrador baixa o backup',
  'listar-usuarios': 'sem permissão para ver os usuários',
};
const proibido = (acao) => [403, { erro: NEGADO[acao] }];
const QA_SUMIU = [404, { erro: 'QA não encontrado (pode ter sido removido por outra pessoa)' }];
const PROJETO_SUMIU = [404, { erro: 'projeto não encontrado (pode ter sido removido por outra pessoa)' }];

/** Rotas que exigem sessao: [metodo, padrao, (banco, params, corpo, quem) => [status, dados]]. */
const ROTAS = [
  ['GET', /^\/api\/versao$/, (b) => [200, { versao: b.versao() }]],
  ['GET', /^\/api\/dados$/, (b) => [200, b.dados()]],
  ['GET', /^\/api\/usuarios$/, (b, _, __, q) => (pode(q, 'listar-usuarios')
    ? [200, b.listaUsuarios().map((u) => ({ id: u.id, usuario: u.usuario }))] : proibido('listar-usuarios'))],
  ['POST', /^\/api\/membros$/, (b, _, c, q) => (pode(q, 'criar-qa')
    ? [201, b.criaMembro(c.nome, q.usuario, c.usuarioId)] : proibido('criar-qa'))],
  ['PATCH', /^\/api\/membros\/(\d+)$/, (b, [id], c, q) => {
    const dono = b.donoDoMembro(id);
    if (dono === undefined) return QA_SUMIU;
    if ('usuarioId' in c) {
      if (!pode(q, 'vincular-qa')) return proibido('vincular-qa');
      b.vinculaMembro(id, c.usuarioId, q.usuario);
    }
    if ('nome' in c) {
      if (!pode(q, 'editar-qa', dono)) return proibido('editar-qa');
      b.renomeiaMembro(id, c.nome, q.usuario);
    }
    return [200, { ok: true }];
  }],
  ['DELETE', /^\/api\/membros\/(\d+)$/, (b, [id], _, q) => {
    if (!pode(q, 'remover-qa')) return proibido('remover-qa');
    return b.removeMembro(id) ? [200, { ok: true }] : QA_SUMIU;
  }],
  ['POST', /^\/api\/membros\/(\d+)\/projetos$/, (b, [id], _, q) => {
    const dono = b.donoDoMembro(id);
    if (dono === undefined) return QA_SUMIU;
    if (!pode(q, 'editar-qa', dono)) return proibido('editar-qa');
    const p = b.criaProjeto(id, q.usuario);
    return p ? [201, p] : QA_SUMIU;
  }],
  ['PATCH', /^\/api\/projetos\/(\d+)$/, (b, [id], c, q) => {
    const membro = b.membroDoProjeto(id);
    if (membro === undefined) return PROJETO_SUMIU;
    if (!pode(q, 'editar-qa', b.donoDoMembro(membro))) return proibido('editar-qa');
    const p = b.alteraProjeto(id, c, q.usuario);
    return p ? [200, p] : PROJETO_SUMIU;
  }],
  ['DELETE', /^\/api\/projetos\/(\d+)$/, (b, [id], _, q) => {
    const membro = b.membroDoProjeto(id);
    if (membro === undefined) return PROJETO_SUMIU;
    if (!pode(q, 'editar-qa', b.donoDoMembro(membro))) return proibido('editar-qa');
    return b.removeProjeto(id) ? [200, { ok: true }] : PROJETO_SUMIU;
  }],
  ['POST', /^\/api\/importar$/, (b, _, c, q) => (pode(q, 'importar')
    ? [200, b.importa(c.membros, q.usuario)] : proibido('importar'))],
];

async function api(banco, req, res, caminho, base) {
  const escreve = req.method !== 'GET' && req.method !== 'HEAD';
  if (escreve && origemEstranha(req)) return json(res, 403, { erro: 'origem não permitida' });
  // Formulario de outro site sempre manda corpo de outro tipo; JSON exige
  // preflight de CORS, que este servidor nao autoriza.
  const tipo = String(req.headers['content-type'] || '');
  if (escreve && tipo && !/^application\/json/i.test(tipo)) {
    return json(res, 415, { erro: 'envie JSON (Content-Type: application/json)' });
  }
  try {
    // --- sem sessao
    if (caminho === '/api/login' && req.method === 'POST') {
      const c = await leCorpo(req);
      const usuario = String(c.usuario ?? '').trim().toLowerCase();
      const chaves = [`u:${usuario}`, `ip:${req.socket.remoteAddress}`];
      if (bloqueado(chaves)) {
        return json(res, 429, { erro: 'muitas tentativas erradas; espere 5 minutos e tente de novo' });
      }
      const u = banco.autentica(usuario, c.senha);
      if (!u) {
        registraFalha(chaves);
        return json(res, 401, { erro: 'usuário ou senha incorretos' });
      }
      for (const k of chaves) falhas.delete(k);
      const token = banco.abreSessao(u.id);
      return json(res, 200, { id: u.id, usuario: u.usuario, perfil: u.perfil, trocarSenha: u.trocarSenha },
        { 'Set-Cookie': cookie(req, token, SESSAO_HORAS * 3600, base) });
    }
    if (caminho === '/api/logout' && req.method === 'POST') {
      banco.fechaSessao(tokenDoCookie(req));
      return json(res, 200, { ok: true }, { 'Set-Cookie': cookie(req, '', 0, base) });
    }

    // --- daqui para baixo, so com sessao
    const token = tokenDoCookie(req);
    const quem = banco.sessao(token);
    if (!quem) return json(res, 401, { erro: 'faça login' });

    if (caminho === '/api/eu' && req.method === 'GET') {
      return json(res, 200, { id: quem.id, usuario: quem.usuario, perfil: quem.perfil, trocarSenha: quem.trocarSenha });
    }
    if (caminho === '/api/senha' && req.method === 'POST') {
      const c = await leCorpo(req);
      banco.trocaSenha(quem.id, c.atual, c.nova, token);
      return json(res, 200, { ok: true });
    }
    // Senha provisoria: so troca de senha e sair, ate trocar.
    if (quem.trocarSenha) return json(res, 403, { erro: 'troque a senha provisória antes de continuar' });

    for (const [metodo, padrao, f] of ROTAS) {
      const m = caminho.match(padrao);
      if (!m || req.method !== metodo) continue;
      const corpo = metodo === 'GET' || metodo === 'DELETE' ? {} : await leCorpo(req);
      const [status, dados] = f(banco, m.slice(1).map(Number), corpo || {}, quem);
      return json(res, status, dados);
    }
    // Copia de seguranca: tudo em um JSON, para baixar pelo navegador.
    if (req.method === 'GET' && caminho === '/api/backup') {
      if (!pode(quem, 'backup')) return json(res, 403, { erro: NEGADO.backup });
      const data = new Date().toISOString().slice(0, 10);
      return json(res, 200, banco.dados(),
        { 'Content-Disposition': `attachment; filename="controle-equipe-qa-${data}.json"` });
    }
    return json(res, 404, { erro: 'rota não encontrada' });
  } catch (e) {
    if (e instanceof ErroDeEntrada) return json(res, 400, { erro: e.message });
    console.error(req.method, caminho, e);
    return json(res, 500, { erro: 'erro interno' });
  }
}

async function estatico(pastaSite, req, res, caminho) {
  if (req.method !== 'GET' && req.method !== 'HEAD') return responde(res, 405, '');
  let relativo;
  try {
    relativo = normalize(decodeURIComponent(caminho)).replace(/^([/\\])+/, '');
  } catch {
    return responde(res, 400, '');
  }
  let arquivo = join(pastaSite, relativo);
  if (arquivo !== pastaSite && !arquivo.startsWith(pastaSite + sep)) return responde(res, 404, '');
  let info = await stat(arquivo).catch(() => null);
  // SPA: o que nao e arquivo cai no index.html.
  if (!info || info.isDirectory()) {
    arquivo = join(pastaSite, 'index.html');
    info = await stat(arquivo).catch(() => null);
    if (!info) return responde(res, 503, 'site nao gerado: rode npm run build', { 'Content-Type': 'text/plain' });
  }
  const nome = arquivo.slice(pastaSite.length + 1);
  // Arquivos com hash no nome ficam 1 ano em cache; o index.html nunca.
  const cache = nome.startsWith('assets' + sep) || nome.startsWith('assets/')
    ? 'public, max-age=31536000, immutable' : 'no-cache';
  const corpo = req.method === 'HEAD' ? '' : await readFile(arquivo);
  responde(res, 200, corpo, {
    'Content-Type': TIPOS[extname(arquivo)] || 'application/octet-stream', 'Cache-Control': cache,
  });
}

export function criaServidor({ banco, pastaSite = join(RAIZ, 'dist') }) {
  return createServer((req, res) => {
    const caminho = new URL(req.url || '/', 'http://x').pathname;
    if (caminho === '/healthz' || caminho.endsWith('/healthz')) {
      return responde(res, 200, 'ok\n', { 'Content-Type': 'text/plain' });
    }
    // O app pode morar num subcaminho (https://intranet/controle-qa/): a API e
    // tudo o que vem a partir de "/api/", e o cookie vale so para o subcaminho.
    const i = caminho.indexOf('/api/');
    if (i >= 0) return api(banco, req, res, caminho.slice(i), caminho.slice(0, i) + '/');
    return estatico(pastaSite, req, res, caminho).catch((e) => {
      console.error(e);
      responde(res, 500, '');
    });
  });
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const porta = Number(process.env.PORT || 8080);
  const caminhoBanco = resolve(process.env.DB_PATH || join(RAIZ, 'dados', 'controle.db'));
  const banco = abreBanco(caminhoBanco);
  if (!banco.listaUsuarios().length) {
    console.warn('AVISO: nenhum usuário cadastrado. Crie com: node server/usuarios.mjs criar <usuario>');
  }
  const servidor = criaServidor({ banco });
  servidor.listen(porta, () => console.log(`Controle Equipe QA em http://localhost:${porta} (banco: ${caminhoBanco})`));
  const encerra = () => servidor.close(() => { banco.fecha(); process.exit(0); });
  process.on('SIGTERM', encerra);
  process.on('SIGINT', encerra);
}
