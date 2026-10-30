/**
 * Testes da base compartilhada, do login e da API (node --test, sem dependencias).
 *
 *   npm test
 */
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { abreBanco } from './banco.mjs';
import { criaServidor } from './index.mjs';

let banco;
let servidor;
let base;
let pasta;
let ana;
let bia;

/** Uma "pessoa": guarda o proprio cookie, como um navegador. */
function pessoa() {
  let cookie = '';
  async function chama(metodo, caminho, corpo, extra = {}) {
    const r = await fetch(base + caminho, {
      method: metodo,
      headers: { ...(corpo !== undefined ? { 'Content-Type': 'application/json' } : {}), ...(cookie ? { Cookie: cookie } : {}), ...extra },
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
    const novo = r.headers.get('set-cookie');
    if (novo) cookie = novo.split(';')[0].endsWith('=') ? '' : novo.split(';')[0];
    const tipo = r.headers.get('content-type') || '';
    return { status: r.status, corpo: tipo.includes('json') ? await r.json() : await r.text(), r };
  }
  return { chama, entra: (usuario, senha) => chama('POST', '/api/login', { usuario, senha }), cookie: () => cookie };
}

before(async () => {
  pasta = mkdtempSync(join(tmpdir(), 'controle-qa-'));
  mkdirSync(join(pasta, 'site', 'assets'), { recursive: true });
  writeFileSync(join(pasta, 'site', 'index.html'), '<div id="root"></div>');
  writeFileSync(join(pasta, 'site', 'assets', 'app-abc.js'), 'console.log(1)');
  banco = abreBanco(join(pasta, 'banco', 'teste.db'));
  // ana e bia sao admin: os testes de dados abaixo sao de BASE (duas pessoas
  // gravando); quem pode o que fica no bloco "permissoes".
  banco.criaUsuario('ana', 'senha-da-ana', { trocarSenha: false, perfil: 'admin' });
  banco.criaUsuario('bia', 'senha-da-bia', { trocarSenha: false, perfil: 'admin' });
  servidor = criaServidor({ banco, pastaSite: join(pasta, 'site') });
  await new Promise((ok) => servidor.listen(0, ok));
  base = `http://127.0.0.1:${servidor.address().port}`;
  ana = pessoa();
  bia = pessoa();
  assert.equal((await ana.entra('ana', 'senha-da-ana')).status, 200);
  assert.equal((await bia.entra('BIA', 'senha-da-bia')).status, 200, 'usuario sem diferenca de maiuscula');
});

after(() => {
  servidor.close();
  banco.fecha();
  rmSync(pasta, { recursive: true, force: true });
});

// ------------------------------------------------------------------ login
test('sem login, a API nao entrega nem grava nada', async () => {
  const anonimo = pessoa();
  assert.equal((await anonimo.chama('GET', '/api/dados')).status, 401);
  assert.equal((await anonimo.chama('GET', '/api/versao')).status, 401);
  assert.equal((await anonimo.chama('POST', '/api/membros', { nome: 'x' })).status, 401);
  assert.equal((await anonimo.chama('GET', '/api/backup')).status, 401);
  assert.equal((await anonimo.chama('GET', '/healthz')).status, 200, 'healthcheck continua publico');
  assert.equal((await anonimo.chama('GET', '/')).status, 200, 'a tela (com o formulario de login) e publica');
});

test('senha errada e usuario inexistente dao a mesma resposta', async () => {
  const x = pessoa();
  const errada = await x.entra('ana', 'nao-e-essa');
  const ninguem = await x.entra('fulano', 'qualquer-coisa');
  assert.equal(errada.status, 401);
  assert.deepEqual(errada.corpo, ninguem.corpo, 'nao revela quem existe');
});

test('cookie de sessao: HttpOnly, SameSite=Strict, sem senha nem dado do usuario', async () => {
  const x = pessoa();
  const r = await x.entra('ana', 'senha-da-ana');
  const c = r.r.headers.get('set-cookie');
  assert.match(c, /HttpOnly/);
  assert.match(c, /SameSite=Strict/);
  assert.doesNotMatch(c, /senha|ana/);
  assert.doesNotMatch(c, /Secure/, 'em HTTP sem proxy, sem Secure (senao o navegador recusa)');
  const viaProxy = await x.chama('POST', '/api/login', { usuario: 'ana', senha: 'senha-da-ana' }, { 'X-Forwarded-Proto': 'https' });
  assert.match(viaProxy.r.headers.get('set-cookie'), /Secure/, 'atras de proxy HTTPS, Secure');
});

test('5 senhas erradas bloqueiam o usuario, ate a certa', async () => {
  banco.criaUsuario('caio', 'senha-do-caio', { trocarSenha: false });
  const x = pessoa();
  for (let i = 0; i < 5; i++) assert.equal((await x.entra('caio', 'errada-' + i)).status, 401);
  const r = await x.entra('caio', 'senha-do-caio');
  assert.equal(r.status, 429);
  assert.match(r.corpo.erro, /5 minutos/);
  // Mesmo IP (a equipe atras do proxy): os outros continuam entrando.
  assert.equal((await pessoa().entra('ana', 'senha-da-ana')).status, 200, 'erro de um nao tranca a equipe');
});

test('sair encerra a sessao no servidor (o cookie antigo nao vale mais)', async () => {
  const x = pessoa();
  await x.entra('ana', 'senha-da-ana');
  const antigo = x.cookie();
  assert.equal((await x.chama('POST', '/api/logout')).status, 200);
  const r = await fetch(base + '/api/dados', { headers: { Cookie: antigo } });
  assert.equal(r.status, 401);
});

test('senha provisoria: so troca de senha ate trocar; a nova vale, a velha nao', async () => {
  banco.criaUsuario('davi', 'provisoria-1');
  const x = pessoa();
  const r = await x.entra('davi', 'provisoria-1');
  assert.equal(r.corpo.trocarSenha, true);
  assert.equal((await x.chama('GET', '/api/dados')).status, 403);
  assert.equal((await x.chama('POST', '/api/senha', { atual: 'errada', nova: 'nova-senha-1' })).status, 400);
  assert.equal((await x.chama('POST', '/api/senha', { atual: 'provisoria-1', nova: 'curta' })).status, 400);
  assert.equal((await x.chama('POST', '/api/senha', { atual: 'provisoria-1', nova: 'nova-senha-1' })).status, 200);
  assert.equal((await x.chama('GET', '/api/dados')).status, 200, 'a sessao de agora continua');
  assert.equal((await pessoa().entra('davi', 'provisoria-1')).status, 401);
  assert.equal((await pessoa().entra('davi', 'nova-senha-1')).status, 200);
});

test('banco guarda so hash da senha e do token', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(join(pasta, 'banco', 'teste.db'), { readOnly: true });
  const u = db.prepare("SELECT senha_hash FROM usuarios WHERE usuario = 'ana'").get();
  assert.match(u.senha_hash, /^scrypt\$/);
  assert.doesNotMatch(u.senha_hash, /senha-da-ana/);
  const tokenDaAna = ana.cookie().split('=')[1];
  const s = db.prepare('SELECT token_hash FROM sessoes').all().map((x) => x.token_hash);
  assert.ok(!s.includes(tokenDaAna), 'o token do cookie nao esta no banco');
  db.close();
});

test('gravacao vinda de outro site e recusada', async () => {
  const r = await ana.chama('POST', '/api/membros', { nome: 'x' }, { Origin: 'https://site-malicioso.com' });
  assert.equal(r.status, 403);
  const semJson = await fetch(base + '/api/membros', { method: 'POST', headers: { Cookie: ana.cookie(), 'Content-Type': 'text/plain' }, body: '{"nome":"x"}' });
  assert.equal(semJson.status, 415, 'formulario de outro site nao manda JSON');
});

// ------------------------------------------------------------------ dados
test('o que uma pessoa cadastra, a outra ve', async () => {
  const qa = await ana.chama('POST', '/api/membros', { nome: '  Lia  ' });
  assert.equal(qa.status, 201);
  assert.equal(qa.corpo.nome, 'Lia');
  const proj = await ana.chama('POST', `/api/membros/${qa.corpo.id}/projetos`);
  assert.equal(proj.status, 201);
  const lia = (await bia.chama('GET', '/api/dados')).corpo.membros.find((m) => m.id === qa.corpo.id);
  assert.equal(lia.nome, 'Lia');
  assert.equal(lia.projetos.length, 1);
});

test('edicoes em campos diferentes, ao mesmo tempo, nao se apagam; fica quem alterou', async () => {
  const qa = (await ana.chama('POST', '/api/membros', { nome: 'Rui' })).corpo;
  const p = (await ana.chama('POST', `/api/membros/${qa.id}/projetos`)).corpo;
  await Promise.all([
    ana.chama('PATCH', `/api/projetos/${p.id}`, { pros: 'equipe boa' }),
    bia.chama('PATCH', `/api/projetos/${p.id}`, { contras: 'prazo curto' }),
    ana.chama('PATCH', `/api/projetos/${p.id}`, { percentualFoco: 150 }),
  ]);
  const visto = (await bia.chama('GET', '/api/dados')).corpo.membros.find((m) => m.id === qa.id).projetos[0];
  assert.equal(visto.pros, 'equipe boa');
  assert.equal(visto.contras, 'prazo curto');
  assert.equal(visto.percentualFoco, 100, 'percentual limitado a 100');
  await bia.chama('PATCH', `/api/projetos/${p.id}`, { nome: 'Portal' });
  const { DatabaseSync } = await import('node:sqlite');
  const db = new DatabaseSync(join(pasta, 'banco', 'teste.db'), { readOnly: true });
  assert.equal(db.prepare('SELECT atualizado_por FROM projetos WHERE id = ?').get(p.id).atualizado_por, 'bia');
  db.close();
});

test('a versao sobe a cada gravacao (e o que faz a tela dos outros recarregar)', async () => {
  const v1 = (await ana.chama('GET', '/api/versao')).corpo.versao;
  await bia.chama('POST', '/api/membros', { nome: 'Teo' });
  const v2 = (await ana.chama('GET', '/api/versao')).corpo.versao;
  assert.ok(v2 > v1);
  await ana.chama('GET', '/api/dados');
  assert.equal((await ana.chama('GET', '/api/versao')).corpo.versao, v2, 'leitura nao muda a versao');
});

test('remover o QA remove os projetos dele', async () => {
  const qa = (await ana.chama('POST', '/api/membros', { nome: 'Davi' })).corpo;
  const p = (await ana.chama('POST', `/api/membros/${qa.id}/projetos`)).corpo;
  assert.equal((await ana.chama('DELETE', `/api/membros/${qa.id}`)).status, 200);
  assert.equal((await ana.chama('PATCH', `/api/projetos/${p.id}`, { nome: 'x' })).status, 404);
  assert.equal((await ana.chama('POST', `/api/membros/${qa.id}/projetos`)).status, 404);
});

test('entrada invalida responde 400 e nao grava', async () => {
  const v = (await ana.chama('GET', '/api/versao')).corpo.versao;
  assert.equal((await ana.chama('POST', '/api/membros', { nome: '   ' })).status, 400);
  assert.equal((await ana.chama('POST', '/api/membros', { nome: 'x'.repeat(201) })).status, 400);
  const qa = (await ana.chama('POST', '/api/membros', { nome: 'Eva' })).corpo;
  const p = (await ana.chama('POST', `/api/membros/${qa.id}/projetos`)).corpo;
  assert.equal((await ana.chama('PATCH', `/api/projetos/${p.id}`, { situacao: 'Inventada' })).status, 400);
  assert.equal((await ana.chama('PATCH', `/api/projetos/${p.id}`, {})).status, 400);
  const r = await fetch(`${base}/api/membros`, { method: 'POST', headers: { Cookie: ana.cookie(), 'Content-Type': 'application/json' }, body: '{quebrado' });
  assert.equal(r.status, 400);
  assert.equal((await ana.chama('GET', '/api/versao')).corpo.versao, v + 2, 'so o QA e o projeto validos gravaram');
});

test('importar dados do navegador acrescenta, nunca substitui', async () => {
  const antes = (await ana.chama('GET', '/api/dados')).corpo.membros.length;
  const r = await ana.chama('POST', '/api/importar', { membros: [
    { id: 1, nome: 'Fabi', projetos: [{ id: 9, nome: 'App', situacao: 'Testes', percentualFoco: '40', pros: 'a', contras: 'b' }] },
    { id: 2, nome: '', projetos: [] },
  ] });
  assert.deepEqual(r.corpo, { qas: 1, projetos: 1 });
  const depois = (await ana.chama('GET', '/api/dados')).corpo.membros;
  assert.equal(depois.length, antes + 1);
  const fabi = depois.at(-1);
  assert.equal(fabi.projetos[0].percentualFoco, 40, 'percentual antigo gravado como texto vira numero');
  assert.equal(fabi.projetos[0].situacao, 'Testes');
});

// ------------------------------------------------------------------ permissoes
test('permissoes: admin tudo, gestor cria/remove QA, qa so o proprio QA', async () => {
  banco.criaUsuario('jo', 'senha-do-jo', { trocarSenha: false, perfil: 'admin' });
  banco.criaUsuario('nat', 'senha-do-nat', { trocarSenha: false, perfil: 'gestor' });
  banco.criaUsuario('lais', 'senha-da-lais', { trocarSenha: false });
  banco.criaUsuario('rom', 'senha-do-rom', { trocarSenha: false });
  const [jo, nat, lais, rom] = [pessoa(), pessoa(), pessoa(), pessoa()];
  await jo.entra('jo', 'senha-do-jo');
  await nat.entra('nat', 'senha-do-nat');
  await lais.entra('lais', 'senha-da-lais');
  await rom.entra('rom', 'senha-do-rom');
  const eu = (await lais.chama('GET', '/api/eu')).corpo;
  assert.equal(eu.perfil, 'qa');

  // Criar QA: so gestor e admin; o dono e escolhido na criacao.
  const ids = Object.fromEntries((await nat.chama('GET', '/api/usuarios')).corpo.map((u) => [u.usuario, u.id]));
  assert.equal((await lais.chama('GET', '/api/usuarios')).status, 403, 'qa nao lista usuarios');
  assert.equal((await lais.chama('POST', '/api/membros', { nome: 'Outro' })).status, 403, 'qa nao cria QA');
  const qaLais = await nat.chama('POST', '/api/membros', { nome: 'Lais', usuarioId: ids.lais });
  assert.equal(qaLais.status, 201, 'gestor cria QA');
  assert.equal(qaLais.corpo.usuario, 'lais');
  const qaRom = (await jo.chama('POST', '/api/membros', { nome: 'Romario', usuarioId: ids.rom })).corpo;
  const qaNat = (await jo.chama('POST', '/api/membros', { nome: 'Nathan', usuarioId: ids.nat })).corpo;
  assert.equal((await nat.chama('POST', '/api/membros', { nome: 'X', usuarioId: 99999 })).status, 400, 'dono inexistente');

  // Projetos: o dono mexe no proprio QA; ninguem (fora o admin) mexe no dos outros.
  const pLais = await lais.chama('POST', `/api/membros/${qaLais.corpo.id}/projetos`);
  assert.equal(pLais.status, 201, 'lais cria projeto no QA dela');
  assert.equal((await lais.chama('PATCH', `/api/projetos/${pLais.corpo.id}`, { nome: 'Portal' })).status, 200);
  assert.equal((await rom.chama('PATCH', `/api/projetos/${pLais.corpo.id}`, { nome: 'invadido' })).status, 403, 'romario nao altera o QA da lais');
  assert.equal((await rom.chama('DELETE', `/api/projetos/${pLais.corpo.id}`)).status, 403);
  assert.equal((await rom.chama('POST', `/api/membros/${qaLais.corpo.id}/projetos`)).status, 403);
  assert.equal((await nat.chama('PATCH', `/api/projetos/${pLais.corpo.id}`, { nome: 'x' })).status, 403, 'gestor nao altera QA dos outros');
  assert.equal((await nat.chama('POST', `/api/membros/${qaNat.id}/projetos`)).status, 201, 'gestor altera o proprio');
  assert.equal((await jo.chama('PATCH', `/api/projetos/${pLais.corpo.id}`, { contras: 'pelo admin' })).status, 200, 'admin altera qualquer um');
  const visto = (await rom.chama('GET', '/api/dados')).corpo.membros.find((m) => m.id === qaLais.corpo.id);
  assert.equal(visto.projetos[0].nome, 'Portal', 'todos VEEM tudo; a tentativa negada nao gravou');

  // Remover QA: gestor e admin; qa nao (nem o proprio).
  assert.equal((await lais.chama('DELETE', `/api/membros/${qaLais.corpo.id}`)).status, 403);
  assert.equal((await nat.chama('DELETE', `/api/membros/${qaRom.id}`)).status, 200, 'gestor remove QA');

  // Dono: so o admin troca. Sem dono, so o admin edita.
  assert.equal((await nat.chama('PATCH', `/api/membros/${qaLais.corpo.id}`, { usuarioId: ids.nat })).status, 403);
  assert.equal((await jo.chama('PATCH', `/api/membros/${qaLais.corpo.id}`, { usuarioId: null })).status, 200);
  assert.equal((await lais.chama('PATCH', `/api/projetos/${pLais.corpo.id}`, { nome: 'y' })).status, 403, 'sem dono, lais perdeu o acesso');
  assert.equal((await jo.chama('PATCH', `/api/membros/${qaLais.corpo.id}`, { usuarioId: ids.lais })).status, 200);
  assert.equal((await lais.chama('PATCH', `/api/projetos/${pLais.corpo.id}`, { nome: 'Portal 2' })).status, 200, 'dona de novo');

  // Importar e backup: so admin.
  assert.equal((await nat.chama('POST', '/api/importar', { membros: [] })).status, 403);
  assert.equal((await lais.chama('GET', '/api/backup')).status, 403);
  assert.equal((await jo.chama('GET', '/api/backup')).status, 200);

  // Perfil mudado no servidor vale na hora, sem novo login.
  banco.definePerfil('lais', 'gestor');
  assert.equal((await lais.chama('GET', '/api/usuarios')).status, 200);
  banco.definePerfil('lais', 'qa');
});

test('banco antigo (sem perfil nem dono) ganha as colunas sozinho e continua entrando', async () => {
  const { DatabaseSync } = await import('node:sqlite');
  const arq = join(pasta, 'antigo.db');
  const velho = new DatabaseSync(arq);
  velho.exec(`CREATE TABLE usuarios (id INTEGER PRIMARY KEY AUTOINCREMENT, usuario TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL, trocar_senha INTEGER NOT NULL DEFAULT 1, criado_em TEXT NOT NULL DEFAULT (datetime('now')));
    CREATE TABLE membros (id INTEGER PRIMARY KEY AUTOINCREMENT, nome TEXT NOT NULL,
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now')), atualizado_por TEXT NOT NULL DEFAULT '');
    INSERT INTO membros (nome) VALUES ('Antigo');`);
  velho.close();
  const b = abreBanco(arq);
  b.criaUsuario('zeca', 'senha-do-zeca', { perfil: 'gestor' });
  assert.equal(b.autentica('zeca', 'senha-do-zeca').perfil, 'gestor');
  assert.equal(b.dados().membros[0].usuarioId, null, 'QA antigo fica sem dono (so o admin edita ate vincular)');
  b.fecha();
});

// ------------------------------------------------------------------ site
test('site: SPA, cache e cabecalhos de seguranca', async () => {
  const x = pessoa();
  const pagina = await x.chama('GET', '/qualquer/rota');
  assert.equal(pagina.status, 200);
  assert.match(pagina.corpo, /id="root"/);
  assert.equal(pagina.r.headers.get('cache-control'), 'no-cache');
  assert.match(pagina.r.headers.get('content-security-policy'), /default-src 'self'/);
  const asset = await x.chama('GET', '/assets/app-abc.js');
  assert.match(asset.r.headers.get('cache-control'), /immutable/);
  // %2f chega cru ao servidor (o fetch so limpa "../" literal).
  const fuga = await x.chama('GET', '/..%2f..%2f..%2f..%2fetc%2fpasswd');
  assert.equal(String(fuga.corpo).includes('root:'), false, 'nunca entrega arquivo fora do site');
  assert.equal((await x.chama('GET', '/%E0%A4%A')).status, 400, 'URL malformada nao derruba');
});

test('em subcaminho (https://intranet/controle-qa/) a API responde e o cookie fica no subcaminho', async () => {
  const x = pessoa();
  const r = await x.chama('POST', '/controle-qa/api/login', { usuario: 'ana', senha: 'senha-da-ana' });
  assert.match(r.r.headers.get('set-cookie'), /Path=\/controle-qa\//);
  assert.equal(typeof (await x.chama('GET', '/controle-qa/api/versao')).corpo.versao, 'number');
});
