import type { Membro, Projeto } from '../types';

/**
 * Cliente da API (server/index.mjs).
 *
 * Os caminhos sao relativos a pagina: o app funciona na raiz do dominio ou num
 * subcaminho (https://intranet/controle-qa/) sem rebuild. A sessao vai no
 * cookie, que o navegador manda sozinho; quando o servidor responde 401, a
 * tela volta para o login (evento SESSAO_ENCERRADA).
 */

export interface Dados {
  versao: number;
  membros: Membro[];
}

export interface Eu {
  usuario: string;
  trocarSenha: boolean;
}

export const SESSAO_ENCERRADA = 'controle-sessao-encerrada';

export class ErroDaApi extends Error {
  constructor(public status: number, mensagem: string) {
    super(mensagem);
  }
}

const url = (caminho: string) => new URL(`api/${caminho}`, document.baseURI).toString();

async function chama<T>(metodo: string, caminho: string, corpo?: unknown, keepalive = false): Promise<T> {
  let r: Response;
  try {
    r = await fetch(url(caminho), {
      method: metodo,
      headers: corpo === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
      cache: 'no-store',
      credentials: 'same-origin',
      keepalive,
    });
  } catch {
    throw new ErroDaApi(0, 'sem conexão com o servidor');
  }
  const dados = await r.json().catch(() => ({}));
  if (r.status === 401 && caminho !== 'login') window.dispatchEvent(new Event(SESSAO_ENCERRADA));
  if (!r.ok) throw new ErroDaApi(r.status, String(dados?.erro || `erro ${r.status}`));
  return dados as T;
}

export const api = {
  entra: (usuario: string, senha: string) => chama<Eu>('POST', 'login', { usuario, senha }),
  sai: () => chama<{ ok: true }>('POST', 'logout'),
  eu: () => chama<Eu>('GET', 'eu'),
  trocaSenha: (atual: string, nova: string) => chama<{ ok: true }>('POST', 'senha', { atual, nova }),

  dados: () => chama<Dados>('GET', 'dados'),
  versao: () => chama<{ versao: number }>('GET', 'versao').then((r) => r.versao),
  criaMembro: (nome: string) => chama<Membro>('POST', 'membros', { nome }),
  removeMembro: (id: number) => chama<{ ok: true }>('DELETE', `membros/${id}`),
  criaProjeto: (membroId: number) => chama<Projeto>('POST', `membros/${membroId}/projetos`),
  /** `keepalive`: termina de gravar mesmo se a pessoa fechar a aba. */
  alteraProjeto: (id: number, campos: Partial<Projeto>, keepalive = false) =>
    chama<Projeto>('PATCH', `projetos/${id}`, campos, keepalive),
  removeProjeto: (id: number) => chama<{ ok: true }>('DELETE', `projetos/${id}`),
  importa: (membros: Membro[]) => chama<{ qas: number; projetos: number }>('POST', 'importar', { membros }),
};
