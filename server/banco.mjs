/**
 * Base compartilhada da equipe (SQLite embutido no Node, sem dependencia).
 *
 * Cada QA e cada projeto e uma linha: uma edicao grava so o campo que mudou,
 * entao duas pessoas mexendo em coisas diferentes nao apagam o trabalho uma da
 * outra. `versao` sobe a cada gravacao; a tela pergunta por ela para saber se
 * alguem mudou algo e recarregar.
 *
 * Usuarios: senha so como hash scrypt (sal proprio por usuario). Sessoes: o
 * banco guarda o hash do token, nunca o token que esta no cookie.
 */
import { DatabaseSync } from 'node:sqlite';
import { createHash, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto';
import { mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

export const SITUACOES = ['Planejamento', 'Em Andamento', 'Testes', 'Homologação', 'Concluído', 'Pausado'];

const MAX_NOME = 200;
const MAX_TEXTO = 5000;
export const SENHA_MINIMA = 8;
export const SESSAO_HORAS = 12;

/** Erro de entrada: o servidor responde 400 com a mensagem. */
export class ErroDeEntrada extends Error {}

function texto(valor, max, campo) {
  const t = String(valor ?? '');
  if (t.length > max) throw new ErroDeEntrada(`${campo}: no máximo ${max} caracteres`);
  return t;
}

export function percentual(valor) {
  const n = parseFloat(String(valor));
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

function situacao(valor) {
  return SITUACOES.includes(valor) ? valor : 'Em Andamento';
}

// ------------------------------------------------------------------ senhas
const SCRYPT = { N: 16384, r: 8, p: 1, tamanho: 64 };

export function hashDaSenha(senha) {
  const sal = randomBytes(16);
  const h = scryptSync(String(senha), sal, SCRYPT.tamanho, { N: SCRYPT.N, r: SCRYPT.r, p: SCRYPT.p });
  return ['scrypt', SCRYPT.N, SCRYPT.r, SCRYPT.p, sal.toString('base64'), h.toString('base64')].join('$');
}

export function confereSenha(senha, guardado) {
  const [alg, N, r, p, sal, h] = String(guardado || '').split('$');
  if (alg !== 'scrypt' || !sal || !h) return false;
  const esperado = Buffer.from(h, 'base64');
  const calculado = scryptSync(String(senha), Buffer.from(sal, 'base64'), esperado.length,
    { N: Number(N), r: Number(r), p: Number(p) });
  return timingSafeEqual(calculado, esperado);
}

// Hash de uma senha qualquer: login com usuario inexistente gasta o mesmo tempo
// que com senha errada, e o tempo de resposta nao entrega quem existe.
const HASH_FALSO = hashDaSenha(randomBytes(12).toString('hex'));

const hashDoToken = (token) => createHash('sha256').update(String(token)).digest('hex');

export function validaSenhaNova(senha) {
  const s = String(senha ?? '');
  if (s.length < SENHA_MINIMA) throw new ErroDeEntrada(`a senha precisa de pelo menos ${SENHA_MINIMA} caracteres`);
  if (s.length > 200) throw new ErroDeEntrada('senha longa demais');
  return s;
}

function nomeDeUsuario(usuario) {
  const u = String(usuario ?? '').trim().toLowerCase();
  if (!/^[a-z0-9._-]{2,40}$/.test(u)) {
    throw new ErroDeEntrada('usuário: de 2 a 40 caracteres, só letras, números, ponto, hífen e sublinhado');
  }
  return u;
}

// ------------------------------------------------------------------ banco
export function abreBanco(caminho) {
  if (caminho !== ':memory:') mkdirSync(dirname(caminho), { recursive: true });
  const db = new DatabaseSync(caminho);
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;
    PRAGMA busy_timeout = 5000;
    CREATE TABLE IF NOT EXISTS meta (chave TEXT PRIMARY KEY, valor INTEGER NOT NULL);
    INSERT OR IGNORE INTO meta (chave, valor) VALUES ('versao', 0);
    CREATE TABLE IF NOT EXISTS usuarios (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      usuario TEXT NOT NULL UNIQUE,
      senha_hash TEXT NOT NULL,
      trocar_senha INTEGER NOT NULL DEFAULT 1,
      criado_em TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE IF NOT EXISTS sessoes (
      token_hash TEXT PRIMARY KEY,
      usuario_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
      expira_em INTEGER NOT NULL
    );
    CREATE TABLE IF NOT EXISTS membros (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      nome TEXT NOT NULL,
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_por TEXT NOT NULL DEFAULT ''
    );
    CREATE TABLE IF NOT EXISTS projetos (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      membro_id INTEGER NOT NULL REFERENCES membros(id) ON DELETE CASCADE,
      nome TEXT NOT NULL DEFAULT '',
      situacao TEXT NOT NULL DEFAULT 'Em Andamento',
      percentual_foco REAL NOT NULL DEFAULT 0,
      pros TEXT NOT NULL DEFAULT '',
      contras TEXT NOT NULL DEFAULT '',
      atualizado_em TEXT NOT NULL DEFAULT (datetime('now')),
      atualizado_por TEXT NOT NULL DEFAULT ''
    );
    CREATE INDEX IF NOT EXISTS projetos_membro ON projetos (membro_id);
  `);

  const sobeVersao = () => db.prepare("UPDATE meta SET valor = valor + 1 WHERE chave = 'versao'").run();
  const versao = () => db.prepare("SELECT valor FROM meta WHERE chave = 'versao'").get().valor;

  /** Varias gravacoes como uma so: ou entram todas, ou nenhuma. */
  function transacao(f, { mudaDados = true } = {}) {
    db.exec('BEGIN');
    try {
      const r = f();
      if (mudaDados) sobeVersao();
      db.exec('COMMIT');
      return r;
    } catch (e) {
      db.exec('ROLLBACK');
      throw e;
    }
  }

  // ---------------------------------------------------------------- usuarios
  function criaUsuario(usuario, senha, { trocarSenha = true } = {}) {
    const u = nomeDeUsuario(usuario);
    const hash = hashDaSenha(validaSenhaNova(senha));
    try {
      db.prepare('INSERT INTO usuarios (usuario, senha_hash, trocar_senha) VALUES (?, ?, ?)')
        .run(u, hash, trocarSenha ? 1 : 0);
    } catch (e) {
      if (/UNIQUE/.test(String(e.message))) throw new ErroDeEntrada(`o usuário "${u}" já existe`);
      throw e;
    }
    return u;
  }

  /** Troca a senha e derruba as sessoes abertas desse usuario. */
  function defineSenha(usuario, senha, { trocarSenha = false } = {}) {
    const u = nomeDeUsuario(usuario);
    const hash = hashDaSenha(validaSenhaNova(senha));
    const linha = db.prepare('SELECT id FROM usuarios WHERE usuario = ?').get(u);
    if (!linha) return false;
    transacao(() => {
      db.prepare('UPDATE usuarios SET senha_hash = ?, trocar_senha = ? WHERE id = ?').run(hash, trocarSenha ? 1 : 0, linha.id);
      db.prepare('DELETE FROM sessoes WHERE usuario_id = ?').run(linha.id);
    }, { mudaDados: false });
    return true;
  }

  function removeUsuario(usuario) {
    return db.prepare('DELETE FROM usuarios WHERE usuario = ?').run(nomeDeUsuario(usuario)).changes > 0;
  }

  function listaUsuarios() {
    return db.prepare('SELECT usuario, trocar_senha AS trocarSenha, criado_em AS criadoEm FROM usuarios ORDER BY usuario').all()
      .map((u) => ({ ...u, trocarSenha: !!u.trocarSenha }));
  }

  /** {usuario, trocarSenha} se a senha confere; senao null. */
  function autentica(usuario, senha) {
    const u = String(usuario ?? '').trim().toLowerCase();
    const linha = db.prepare('SELECT * FROM usuarios WHERE usuario = ?').get(u);
    const ok = confereSenha(String(senha ?? ''), linha ? linha.senha_hash : HASH_FALSO);
    return ok && linha ? { id: linha.id, usuario: linha.usuario, trocarSenha: !!linha.trocar_senha } : null;
  }

  /** Abre sessao: devolve o token que vai no cookie (o banco guarda so o hash). */
  function abreSessao(usuarioId) {
    const token = randomBytes(32).toString('base64url');
    const agora = Date.now();
    db.prepare('DELETE FROM sessoes WHERE expira_em < ?').run(agora);
    db.prepare('INSERT INTO sessoes (token_hash, usuario_id, expira_em) VALUES (?, ?, ?)')
      .run(hashDoToken(token), usuarioId, agora + SESSAO_HORAS * 3600 * 1000);
    return token;
  }

  function sessao(token) {
    if (!token) return null;
    const s = db.prepare(`SELECT u.id, u.usuario, u.trocar_senha FROM sessoes s
      JOIN usuarios u ON u.id = s.usuario_id WHERE s.token_hash = ? AND s.expira_em > ?`)
      .get(hashDoToken(token), Date.now());
    return s ? { id: s.id, usuario: s.usuario, trocarSenha: !!s.trocar_senha } : null;
  }

  function fechaSessao(token) {
    if (token) db.prepare('DELETE FROM sessoes WHERE token_hash = ?').run(hashDoToken(token));
  }

  /** A pessoa troca a propria senha: confere a atual, mantem so a sessao de agora. */
  function trocaSenha(usuarioId, atual, nova, tokenAtual) {
    const linha = db.prepare('SELECT * FROM usuarios WHERE id = ?').get(usuarioId);
    if (!linha || !confereSenha(String(atual ?? ''), linha.senha_hash)) throw new ErroDeEntrada('senha atual incorreta');
    const n = validaSenhaNova(nova);
    if (n === String(atual)) throw new ErroDeEntrada('a senha nova precisa ser diferente da atual');
    transacao(() => {
      db.prepare('UPDATE usuarios SET senha_hash = ?, trocar_senha = 0 WHERE id = ?').run(hashDaSenha(n), usuarioId);
      db.prepare('DELETE FROM sessoes WHERE usuario_id = ? AND token_hash <> ?').run(usuarioId, hashDoToken(tokenAtual));
    }, { mudaDados: false });
  }

  // ---------------------------------------------------------------- dados
  const projetoDaLinha = (p) => ({
    id: p.id, nome: p.nome, situacao: p.situacao, percentualFoco: p.percentual_foco,
    pros: p.pros, contras: p.contras,
  });

  function projeto(id) {
    const p = db.prepare('SELECT * FROM projetos WHERE id = ?').get(id);
    return p ? projetoDaLinha(p) : null;
  }

  function dados() {
    const membros = db.prepare('SELECT id, nome FROM membros ORDER BY id').all()
      .map((m) => ({ id: m.id, nome: m.nome, projetos: [] }));
    const porId = new Map(membros.map((m) => [m.id, m]));
    for (const p of db.prepare('SELECT * FROM projetos ORDER BY id').all()) {
      porId.get(p.membro_id)?.projetos.push(projetoDaLinha(p));
    }
    return { versao: versao(), membros };
  }

  function criaMembro(nome, quem = '') {
    const n = texto(nome, MAX_NOME, 'nome').trim();
    if (!n) throw new ErroDeEntrada('nome do QA vazio');
    return transacao(() => {
      const { lastInsertRowid } = db.prepare('INSERT INTO membros (nome, atualizado_por) VALUES (?, ?)').run(n, quem);
      return { id: Number(lastInsertRowid), nome: n, projetos: [] };
    });
  }

  function renomeiaMembro(id, nome, quem = '') {
    const n = texto(nome, MAX_NOME, 'nome').trim();
    if (!n) throw new ErroDeEntrada('nome do QA vazio');
    return transacao(() => db.prepare(
      "UPDATE membros SET nome = ?, atualizado_em = datetime('now'), atualizado_por = ? WHERE id = ?")
      .run(n, quem, id).changes > 0);
  }

  function removeMembro(id) {
    return transacao(() => db.prepare('DELETE FROM membros WHERE id = ?').run(id).changes > 0);
  }

  function insereProjeto(membroId, p, quem) {
    const { lastInsertRowid } = db.prepare(`INSERT INTO projetos
      (membro_id, nome, situacao, percentual_foco, pros, contras, atualizado_por) VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
      membroId, texto(p.nome, MAX_NOME, 'nome'), situacao(p.situacao), percentual(p.percentualFoco),
      texto(p.pros, MAX_TEXTO, 'prós'), texto(p.contras, MAX_TEXTO, 'contras'), quem);
    return Number(lastInsertRowid);
  }

  /** null quando o QA nao existe mais (alguem removeu enquanto isso). */
  function criaProjeto(membroId, quem = '') {
    if (!db.prepare('SELECT 1 FROM membros WHERE id = ?').get(membroId)) return null;
    return projeto(transacao(() => insereProjeto(membroId, {}, quem)));
  }

  /** Grava so os campos enviados. null quando o projeto nao existe mais. */
  function alteraProjeto(id, campos, quem = '') {
    const sets = [];
    const valores = [];
    if ('nome' in campos) { sets.push('nome = ?'); valores.push(texto(campos.nome, MAX_NOME, 'nome')); }
    if ('situacao' in campos) {
      if (!SITUACOES.includes(campos.situacao)) throw new ErroDeEntrada('situação desconhecida');
      sets.push('situacao = ?'); valores.push(campos.situacao);
    }
    if ('percentualFoco' in campos) { sets.push('percentual_foco = ?'); valores.push(percentual(campos.percentualFoco)); }
    if ('pros' in campos) { sets.push('pros = ?'); valores.push(texto(campos.pros, MAX_TEXTO, 'prós')); }
    if ('contras' in campos) { sets.push('contras = ?'); valores.push(texto(campos.contras, MAX_TEXTO, 'contras')); }
    if (!sets.length) throw new ErroDeEntrada('nenhum campo para alterar');
    const mudou = transacao(() => db.prepare(
      `UPDATE projetos SET ${sets.join(', ')}, atualizado_em = datetime('now'), atualizado_por = ? WHERE id = ?`)
      .run(...valores, quem, id).changes > 0);
    return mudou ? projeto(id) : null;
  }

  function removeProjeto(id) {
    return transacao(() => db.prepare('DELETE FROM projetos WHERE id = ?').run(id).changes > 0);
  }

  /**
   * Traz para a base os dados que uma pessoa tinha so no navegador. ACRESCENTA,
   * nunca substitui: os ids antigos sao descartados e o banco da os novos.
   */
  function importa(lista, quem = '') {
    if (!Array.isArray(lista)) throw new ErroDeEntrada('esperava uma lista de QAs');
    return transacao(() => {
      let qas = 0;
      let projetos = 0;
      for (const m of lista) {
        const nome = texto(m?.nome, MAX_NOME, 'nome').trim();
        if (!nome) continue;
        const { lastInsertRowid } = db.prepare('INSERT INTO membros (nome, atualizado_por) VALUES (?, ?)').run(nome, quem);
        qas += 1;
        for (const p of Array.isArray(m.projetos) ? m.projetos : []) {
          insereProjeto(Number(lastInsertRowid), p || {}, quem);
          projetos += 1;
        }
      }
      return { qas, projetos };
    });
  }

  return {
    versao, dados, criaMembro, renomeiaMembro, removeMembro,
    criaProjeto, alteraProjeto, removeProjeto, importa,
    criaUsuario, defineSenha, removeUsuario, listaUsuarios,
    autentica, abreSessao, sessao, fechaSessao, trocaSenha,
    fecha: () => db.close(),
  };
}
