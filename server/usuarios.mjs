/**
 * Usuarios do Controle Equipe QA, pelo terminal do servidor.
 *
 *   node server/usuarios.mjs listar
 *   node server/usuarios.mjs criar <usuario>      pede a senha (provisoria)
 *   node server/usuarios.mjs senha <usuario>      redefine (provisoria) e derruba as sessoes
 *   node server/usuarios.mjs remover <usuario>
 *
 * A senha NUNCA vai na linha de comando (fica no historico e no `ps`): e
 * digitada sem eco ou chega pela entrada padrao (`... criar lais < arquivo`).
 * Senha criada ou redefinida aqui e provisoria: a pessoa troca no primeiro
 * acesso. `--definitiva` desliga isso.
 *
 * Usa o mesmo banco do servidor: DB_PATH, ou dados/controle.db.
 */
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { abreBanco, ErroDeEntrada } from './banco.mjs';

const RAIZ = resolve(fileURLToPath(new URL('..', import.meta.url)));

/** Le uma linha sem mostrar o que e digitado; sem terminal, le a entrada padrao. */
async function leSenha(pergunta) {
  const { stdin, stdout } = process;
  if (!stdin.isTTY) {
    let dados = '';
    for await (const p of stdin) dados += p;
    return dados.split(/\r?\n/)[0];
  }
  stdout.write(pergunta);
  stdin.setRawMode(true);
  stdin.resume();
  stdin.setEncoding('utf8');
  return new Promise((ok, falha) => {
    let senha = '';
    const tecla = (c) => {
      for (const ch of c) {
        if (ch === '\r' || ch === '\n') {
          stdin.setRawMode(false);
          stdin.pause();
          stdin.off('data', tecla);
          stdout.write('\n');
          return ok(senha);
        }
        if (ch === '\u0003') { stdout.write('\n'); return falha(new Error('cancelado')); }
        if (ch === '\u007f' || ch === '\b') senha = senha.slice(0, -1);
        else senha += ch;
      }
    };
    stdin.on('data', tecla);
  });
}

async function principal() {
  const [comando, usuario, ...resto] = process.argv.slice(2);
  const definitiva = resto.includes('--definitiva');
  const banco = abreBanco(resolve(process.env.DB_PATH || join(RAIZ, 'dados', 'controle.db')));
  try {
    if (comando === 'listar') {
      const lista = banco.listaUsuarios();
      if (!lista.length) console.log('nenhum usuário cadastrado');
      for (const u of lista) console.log(`${u.usuario.padEnd(20)} criado em ${u.criadoEm}${u.trocarSenha ? '  (senha provisória)' : ''}`);
      return 0;
    }
    if (!usuario || !['criar', 'senha', 'remover'].includes(comando)) {
      console.error('uso: node server/usuarios.mjs listar | criar <usuario> | senha <usuario> | remover <usuario> [--definitiva]');
      return 2;
    }
    if (comando === 'remover') {
      console.log(banco.removeUsuario(usuario) ? `removido: ${usuario}` : `não existe: ${usuario}`);
      return 0;
    }
    const senha = await leSenha(`senha para ${usuario}: `);
    if (comando === 'criar') {
      const u = banco.criaUsuario(usuario, senha, { trocarSenha: !definitiva });
      console.log(`criado: ${u}${definitiva ? '' : ' (senha provisória: troca no primeiro acesso)'}`);
    } else {
      const ok = banco.defineSenha(usuario, senha, { trocarSenha: !definitiva });
      console.log(ok ? `senha redefinida: ${usuario}` : `não existe: ${usuario}`);
      if (!ok) return 1;
    }
    return 0;
  } catch (e) {
    if (e instanceof ErroDeEntrada) {
      console.error(`erro: ${e.message}`);
      return 1;
    }
    throw e;
  } finally {
    banco.fecha();
  }
}

process.exitCode = await principal();
